const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { toolRegistry } = require('./llm-tools');

let computeScoreSummaryRef;
function getComputeScoreSummary() {
  if (!computeScoreSummaryRef) {
    ({ computeScoreSummary: computeScoreSummaryRef } = require('./scoring'));
  }
  return computeScoreSummaryRef;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_FILES_URL = 'https://api.openai.com/v1/files';
const OPENAI_VECTOR_STORE_URL = 'https://api.openai.com/v1/vector_stores';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const RAG_MODEL = process.env.OPENAI_RAG_MODEL || DEFAULT_MODEL;
const DEFAULT_TOOLS = ['scoring.compute', 'vendor.match', 'calc.financials', 'rag.query'];

function toJsonSchema(schema, name = 'AgamaSchema') {
  const jsonSchema = zodToJsonSchema(schema, name);
  const { $schema, ...rest } = jsonSchema;
  return rest;
}

async function openAIRequest(body) {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('OpenAI API error', errorText);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('OpenAI API call failed', err);
    return null;
  }
}

async function openAIRestRequest({ url, method = 'POST', headers = {}, body }) {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...headers
      },
      body
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('OpenAI REST error', method, url, text);
      return null;
    }
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res.arrayBuffer();
  } catch (err) {
    console.error('OpenAI REST call failed', err);
    return null;
  }
}

function extractMessageContent(message) {
  if (!message) return '';
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map(part => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  return '';
}

async function uploadFileToOpenAI({ buffer, filename, mime }) {
  if (!OPENAI_API_KEY) return null;
  const form = new FormData();
  const blob = new Blob([buffer], { type: mime || 'application/octet-stream' });
  form.append('purpose', 'assistants');
  form.append('file', blob, filename);
  const data = await openAIRestRequest({ url: OPENAI_FILES_URL, body: form });
  return data;
}

async function createVectorStore({ name }) {
  const payload = JSON.stringify({ name });
  const data = await openAIRestRequest({
    url: OPENAI_VECTOR_STORE_URL,
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });
  return data?.id || null;
}

async function attachFileToVectorStore({ vectorStoreId, fileId }) {
  if (!vectorStoreId || !fileId) return null;
  const payload = JSON.stringify({ file_id: fileId });
  return openAIRestRequest({
    url: `${OPENAI_VECTOR_STORE_URL}/${vectorStoreId}/files`,
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });
}

async function detachFileFromVectorStore({ vectorStoreId, fileId }) {
  if (!vectorStoreId || !fileId) return null;
  return openAIRestRequest({
    url: `${OPENAI_VECTOR_STORE_URL}/${vectorStoreId}/files/${fileId}`,
    method: 'DELETE'
  });
}

async function deleteOpenAIFile(fileId) {
  if (!fileId) return null;
  return openAIRestRequest({
    url: `${OPENAI_FILES_URL}/${fileId}`,
    method: 'DELETE'
  });
}

function extractCitationsFromNode(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach(item => extractCitationsFromNode(item, acc));
    return acc;
  }
  if (typeof node === 'object') {
    if (node.type === 'file_citation' || node.object === 'file_citation') {
      acc.push({
        fileId: node.file_id || node.fileId,
        text: node.quote || node.text || node.content || '',
        page: node.page ?? node.metadata?.page ?? null,
        score: node.score ?? node.metadata?.score ?? null
      });
    }
    Object.values(node).forEach(value => extractCitationsFromNode(value, acc));
  }
  return acc;
}

async function executeRagQuery({ projectId, query, filters = {} }) {
  if (!OPENAI_API_KEY || !projectId || !query) return [];
  const Project = require('../models/Project');
  const File = require('../models/File');

  const project = await Project.findById(projectId).lean();
  if (!project?.ragVectorStoreId) {
    return [];
  }

  const payload = JSON.stringify({
    model: RAG_MODEL,
    input: query,
    extra_body: {
      file_search: {
        vector_store_ids: [project.ragVectorStoreId],
        filters
      }
    }
  });

  const data = await openAIRestRequest({
    url: OPENAI_RESPONSES_URL,
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });
  if (!data) return [];

  const citations = extractCitationsFromNode(data.output || data.outputs || data.data || data);
  if (!citations.length) return [];

  const fileIds = [...new Set(citations.map(c => c.fileId).filter(Boolean))];
  if (!fileIds.length) return [];

  const files = await File.find({ projectId, openaiFileId: { $in: fileIds } }).lean();
  const fileMap = new Map(files.map(file => [file.openaiFileId, file]));

  return citations
    .map(citation => {
      const file = fileMap.get(citation.fileId);
      if (!file) return null;
      return {
        fileId: String(file._id),
        openaiFileId: citation.fileId,
        filename: file.filename,
        page: citation.page ?? null,
        text: citation.text || '',
        score: typeof citation.score === 'number' ? citation.score : null
      };
    })
    .filter(Boolean);
}

async function structuredOutput({ messages, schema, system }) {
  if (!OPENAI_API_KEY) return null;
  const jsonSchema = toJsonSchema(schema, 'StructuredOutput');
  let correction;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const convo = [];
    if (system) {
      convo.push({ role: 'system', content: system });
    }
    (messages || []).forEach(msg => {
      if (msg && msg.role && typeof msg.content === 'string') {
        convo.push(msg);
      }
    });
    if (correction) {
      convo.push({ role: 'system', content: correction });
    }

    const data = await openAIRequest({
      model: DEFAULT_MODEL,
      temperature: 0.3,
      messages: convo,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AgamaStructuredOutput',
          schema: jsonSchema
        }
      }
    });

    if (!data) {
      return null;
    }

    const content = extractMessageContent(data.choices?.[0]?.message);
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content);
      const validation = schema.safeParse(parsed);
      if (validation.success) {
        return validation.data;
      }
      const issues = validation.error.issues
        .map(issue => `${issue.path.join('.') || 'root'} ${issue.message}`)
        .join('; ');
      correction = `Your previous response did not match the schema (${issues}). Reply with valid JSON that matches the schema exactly.`;
    } catch (err) {
      correction = `The previous response was not valid JSON (${err.message}). Return only JSON.`;
    }
  }
  return null;
}

function resolveTools(tools = []) {
  return tools
    .map(tool => {
      if (typeof tool === 'string') return toolRegistry[tool];
      if (tool && tool.name && tool.schema && tool.handler) return tool;
      return null;
    })
    .filter(Boolean);
}

async function toolCalling({ messages, tools = [], system, maxIterations = 6 }) {
  if (!OPENAI_API_KEY) {
    return { response: null, messages: messages || [], executions: [] };
  }
  const resolved = resolveTools(tools);
  if (!resolved.length) {
    return { response: null, messages: messages || [], executions: [] };
  }
  const apiTools = resolved.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool.schema, `${tool.name.replace(/[^a-z0-9]/gi, '_')}Params`)
    }
  }));

  const convo = Array.isArray(messages) ? [...messages] : [];
  const executions = [];
  for (let turn = 0; turn < maxIterations; turn += 1) {
    const attemptMessages = [];
    if (system) {
      attemptMessages.push({ role: 'system', content: system });
    }
    attemptMessages.push(...convo);

    const data = await openAIRequest({
      model: DEFAULT_MODEL,
      temperature: 0,
      messages: attemptMessages,
      tools: apiTools,
      tool_choice: 'auto'
    });

    if (!data) {
      return { response: null, messages: convo, executions };
    }

    const message = data.choices?.[0]?.message;
    if (!message) {
      return { response: null, messages: convo, executions };
    }

    const assistantContent = extractMessageContent(message);
    const assistantMsg = {
      role: 'assistant',
      content: assistantContent || '',
      tool_calls: message.tool_calls || undefined
    };
    convo.push(assistantMsg);

    if (message.tool_calls?.length) {
      for (const toolCall of message.tool_calls) {
        const definition = resolved.find(tool => tool.name === toolCall.function.name);
        if (!definition) {
          convo.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ error: 'UNKNOWN_TOOL' })
          });
          executions.push({
            name: toolCall.function.name,
            args: parsedArgs,
            result: { error: 'UNKNOWN_TOOL' }
          });
          continue;
        }

        let parsedArgs;
        try {
          parsedArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
        } catch (err) {
          parsedArgs = { error: 'INVALID_JSON', message: err.message };
        }

        let result;
        if (parsedArgs.error) {
          result = parsedArgs;
        } else {
          const validation = definition.schema.safeParse(parsedArgs);
          if (!validation.success) {
            result = { error: 'VALIDATION_ERROR', issues: validation.error.issues };
          } else {
            try {
              result = await definition.handler(validation.data);
            } catch (err) {
              result = { error: 'TOOL_EXECUTION_ERROR', message: err.message };
            }
          }
        }

        convo.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: definition.name,
          content: JSON.stringify(result ?? null)
        });
        executions.push({ name: definition.name, args: parsedArgs, result });
      }
      continue;
    }

    return { response: message, messages: convo, executions };
  }

  return { response: null, messages: convo, executions };
}

function safeParseJSON(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function extractRagEvidence(executions = [], section) {
  if (!Array.isArray(executions)) return [];
  const entries = [];
  executions
    .filter(exec => exec && exec.name === 'rag.query' && exec.result && Array.isArray(exec.result.results))
    .forEach(exec => {
      exec.result.results.forEach(item => {
        entries.push({
          section,
          query: exec.result.query || exec.args?.query || '',
          fileId: item.fileId,
          filename: item.filename,
          page: item.page ?? null,
          text: item.text || '',
          score: item.score ?? null
        });
      });
    });
  return entries;
}

async function runToolPlanner({ system, payload }) {
  const planningMessages = [
    {
      role: 'user',
      content: `Context JSON: ${JSON.stringify(payload)}\n\nUse the available tools to gather supporting data. Respond with JSON {scoring?, vendors?, financials?, notes?}.`
    }
  ];
  const { response, executions } = await toolCalling({ messages: planningMessages, tools: DEFAULT_TOOLS, system });
  const plan = response ? safeParseJSON(extractMessageContent(response), {}) : {};
  return { plan, executions: executions || [] };
}

const ExecutiveNarrativeSchema = z.object({
  executiveSummary: z.array(z.string()).max(6),
  strategicRisks: z
    .array(
      z.object({
        risk: z.string(),
        impact: z.string().optional(),
        mitigation: z.string().optional(),
        timeframe: z.string().optional()
      })
    )
    .max(6),
  valueRealisation: z.array(z.string()).max(6),
  personaGuidance: z.record(
    z.object({
      focus: z.array(z.string()).max(4).optional(),
      guidance: z.array(z.string()).max(6)
    })
  ),
  operatingModel: z.object({
    phases: z
      .array(
        z.object({
          phase: z.string(),
          highlights: z.array(z.string()).max(5)
        })
      )
      .max(5)
  })
});

const StrategicIntelligenceSchema = z.object({
  industryHeatmap: z
    .array(
      z.object({
        dimension: z.string(),
        rating: z.string(),
        commentary: z.string().optional()
      })
    )
    .max(8),
  maturityNarrative: z.string().optional(),
  investmentCases: z
    .array(
      z.object({
        title: z.string(),
        outcome: z.string().optional(),
        payback: z.string().optional(),
        sponsors: z.array(z.string()).max(4).optional()
      })
    )
    .max(6),
  riskSignals: z
    .array(
      z.object({
        title: z.string(),
        trigger: z.string().optional(),
        mitigation: z.string().optional(),
        timeframe: z.string().optional()
      })
    )
    .max(6)
});

const CommandBlueprintSchema = z.object({
  vendorOrchestration: z
    .array(
      z.object({
        vendor: z.string(),
        pocFocus: z.array(z.string()).max(5).optional(),
        negotiationMoves: z.array(z.string()).max(5).optional(),
        pricingWatchouts: z.array(z.string()).max(5).optional()
      })
    )
    .max(6),
  architectureDirectives: z.array(z.string()).max(8),
  executiveTimeline: z
    .array(
      z.object({
        phase: z.string(),
        leader: z.string().optional(),
        actions: z.array(z.string()).max(6)
      })
    )
    .max(6),
  boardTalkingPoints: z.array(z.string()).max(8)
});

const ArchitectureAssetsSchema = z.object({
  architectureBlueprint: z.object({
    layers: z
      .array(
        z.object({
          name: z.string(),
          components: z
            .array(
              z.object({
                label: z.string(),
                description: z.string().optional(),
                owners: z.array(z.string()).max(4).optional()
              })
            )
            .max(8)
        })
      )
      .max(6),
    commentary: z.string().optional()
  }),
  roiMap: z
    .array(
      z.object({
        initiative: z.string(),
        valueDrivers: z.array(z.string()).max(5).optional(),
        costToImplement: z.string().optional(),
        paybackWindow: z.string().optional(),
        stakeholders: z.array(z.string()).max(5).optional()
      })
    )
    .max(6),
  renewalCalendar: z
    .array(
      z.object({
        vendor: z.string(),
        renewalWindow: z.string().optional(),
        riskLevel: z.string().optional(),
        recommendedAction: z.string().optional()
      })
    )
    .max(8),
  personaIntelligence: z.record(
    z.object({
      summary: z.string().optional(),
      priorities: z.array(z.string()).max(6).optional(),
      kpis: z.array(z.string()).max(6).optional(),
      questions: z.array(z.string()).max(6).optional(),
      visualNarrative: z.string().optional()
    })
  )
});

const FollowUpSchema = z.object({
  prompts: z
    .array(
      z.object({
        question: z.string(),
        rationale: z.string().optional(),
        suggestedOptions: z.array(z.string()).max(5).optional()
      })
    )
    .max(3)
});

const OrganizationMatchSchema = z.object({
  matches: z
    .array(
      z.object({
        name: z.string().optional(),
        ticker: z.string().optional(),
        hqRegion: z.string().optional(),
        description: z.string().optional(),
        classification: z.string().optional(),
        industryTags: z.array(z.string()).optional(),
        employeeRange: z.string().optional(),
        headcountEstimate: z.string().optional(),
        annualRevenueEstimate: z.string().optional(),
        turnover: z.string().optional(),
        fundingRounds: z
          .array(
            z.object({
              round: z.string().optional(),
              amount: z.string().optional(),
              date: z.string().optional(),
              leadInvestors: z.array(z.string()).optional()
            })
          )
          .optional(),
        investmentHighlights: z.array(z.string()).optional(),
        keyInitiatives: z
          .array(
            z.object({
              name: z.string().optional(),
              objective: z.string().optional(),
              horizon: z.string().optional(),
              description: z.string().optional()
            })
          )
          .optional(),
        organisationStructure: z.array(z.string()).optional(),
        discoveryObjectives: z
          .array(
            z.object({
              objective: z.string().optional(),
              linkedKpis: z.array(z.string()).optional(),
              timeframe: z.string().optional()
            })
          )
          .optional(),
        personaKpis: z.record(z.array(z.string())).optional(),
        sources: z.array(z.string()).optional()
      })
    )
    .max(4),
  confidenceNote: z.string().optional()
});

const OrganizationIntelSchema = z.object({
  summary: z.string(),
  dominantFrameworks: z
    .array(
      z.object({
        name: z.string(),
        guidance: z.string().optional()
      })
    )
    .max(6),
  vendorSignals: z
    .array(
      z.object({
        theme: z.string(),
        leadingVendors: z.array(z.string()).optional(),
        investmentNotes: z.string().optional()
      })
    )
    .max(6),
  profile: z.object({
    canonicalName: z.string().optional(),
    classification: z.string().optional(),
    industryTags: z.array(z.string()).optional(),
    headcountEstimate: z.string().optional(),
    employeeRange: z.string().optional(),
    annualRevenueEstimate: z.string().optional(),
    turnover: z.string().optional(),
    fundingRounds: z
      .array(
        z.object({
          round: z.string().optional(),
          amount: z.string().optional(),
          date: z.string().optional(),
          leadInvestors: z.array(z.string()).optional()
        })
      )
      .optional(),
    investmentHighlights: z.array(z.string()).optional(),
    keyInitiatives: z
      .array(
        z.object({
          name: z.string().optional(),
          objective: z.string().optional(),
          horizon: z.string().optional(),
          description: z.string().optional()
        })
      )
      .optional(),
    organisationStructure: z
      .array(
        z.object({
          function: z.string().optional(),
          leader: z.string().optional(),
          remit: z.string().optional(),
          primaryKpis: z.array(z.string()).optional()
        })
      )
      .optional(),
    discoveryObjectives: z
      .array(
        z.object({
          objective: z.string().optional(),
          linkedKpis: z.array(z.string()).optional(),
          timeframe: z.string().optional()
        })
      )
      .optional(),
    personaKpis: z.record(z.array(z.string())).optional(),
    renewalCalendar: z
      .array(
        z.object({
          vendor: z.string().optional(),
          renewalWindow: z.string().optional(),
          action: z.string().optional()
        })
      )
      .optional(),
    architectureSignals: z
      .array(
        z.object({
          layer: z.string().optional(),
          observation: z.string().optional(),
          implication: z.string().optional()
        })
      )
      .optional(),
    dataConfidence: z.string().optional(),
    sources: z.array(z.string()).optional()
  })
});

const RfpDraftSchema = z.object({
  capability: z.string(),
  industry: z.string().optional(),
  criteria: z
    .array(
      z.object({
        title: z.string(),
        weight: z.number().optional(),
        description: z.string().optional()
      })
    )
    .max(12),
  questions: z
    .array(
      z.object({
        section: z.string().optional(),
        prompt: z.string(),
        guidance: z.string().optional()
      })
    )
    .max(30),
  scoringRubric: z.record(z.any()),
  timeline: z.object({
    phases: z
      .array(
        z.object({
          name: z.string(),
          durationWeeks: z.number().optional(),
          activities: z.array(z.string()).optional()
        })
      )
      .max(8),
    targetLaunch: z.string().optional()
  }),
  stakeholders: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional()
      })
    )
    .max(10)
});

function defaultExecutiveNarrativeFallback() {
  return {
    executiveSummary: [
      'Executive AI summary requires OpenAI configuration. Configure OPENAI_API_KEY to unlock narrative intelligence.'
    ],
    strategicRisks: [],
    valueRealisation: [],
    personaGuidance: {},
    operatingModel: { phases: [] }
  };
}

async function generateExecutiveNarrative({ assessment, report, capability }) {
  if (!OPENAI_API_KEY) {
    return defaultExecutiveNarrativeFallback();
  }
  const payload = {
    organisation: assessment.organization?.name || 'Unknown organisation',
    industry: assessment.industry || assessment.vertical,
    assessmentType: assessment.assessmentType,
    stage: assessment.stage,
    strategicDrivers: assessment.strategicDrivers || [],
    capabilityFocus: assessment.capabilityFocus || [],
    companyProfile: assessment.companyProfile || {},
    techLandscape: assessment.techLandscape || {},
    vendorStrategy: assessment.vendorStrategy || {},
    operatingModel: assessment.operatingModel || {},
    personas: assessment.personas || [],
    officialIntel: assessment.organization?.intel || {},
    report,
    capability
  };

  const toolInsights = await runToolPlanner({
    system: 'You are an enterprise strategist preparing supporting intelligence for an executive narrative.',
    payload
  });
  const plannerContext = {
    plan: toolInsights.plan || {},
    executions: toolInsights.executions || []
  };

  const result = await structuredOutput({
    system:
      "You are Agama Technologies' executive intelligence engine. Craft concise, board-ready narratives with numbered recommendations.",
    schema: ExecutiveNarrativeSchema,
    messages: [
      {
        role: 'user',
        content: `Base context:${JSON.stringify(payload)}`
      },
      {
        role: 'user',
        content: `Supporting insights:${JSON.stringify(plannerContext)}`
      }
    ]
  });

  return result || defaultExecutiveNarrativeFallback();
}

async function generateStrategicIntelligence({ stage, assessment, report, capability }) {
  if (!OPENAI_API_KEY) {
    return {};
  }
  const payload = {
    stage,
    capability,
    assessment,
    report
  };

  const toolInsights = await runToolPlanner({
    system: 'You are preparing industry intelligence and may call tools for scoring or vendor context.',
    payload
  });
  const plannerContext = {
    plan: toolInsights.plan || {},
    executions: toolInsights.executions || []
  };

  const result = await structuredOutput({
    system:
      'You are a senior McKinsey-style consultant creating industry intelligence packs. Respond in JSON that matches the schema.',
    schema: StrategicIntelligenceSchema,
    messages: [
      { role: 'user', content: `Context:${JSON.stringify(payload)}` },
      { role: 'user', content: `Tool research:${JSON.stringify(plannerContext)}` }
    ]
  });

  const evidence = extractRagEvidence(toolInsights.executions, 'strategicIntelligence');
  return { data: result || {}, evidence };
}

async function generateCommandBlueprint({ assessment, capability, vendorEngagements, deliveryTimeline, industryInsights, report }) {
  if (!OPENAI_API_KEY) {
    return {};
  }
  const payload = {
    assessment,
    capability,
    vendorEngagements,
    deliveryTimeline,
    industryInsights,
    report
  };

  const toolInsights = await runToolPlanner({
    system: 'You are a transformation partner planning a command blueprint. Use tools for vendor and ROI insights when helpful.',
    payload
  });
  const plannerContext = {
    plan: toolInsights.plan || {},
    executions: toolInsights.executions || []
  };

  const result = await structuredOutput({
    system:
      'You are an elite transformation partner building a board-level command deck. Respond strictly with JSON that matches the schema.',
    schema: CommandBlueprintSchema,
    messages: [
      { role: 'user', content: `Context:${JSON.stringify(payload)}` },
      { role: 'user', content: `Tool research:${JSON.stringify(plannerContext)}` }
    ]
  });

  const evidence = extractRagEvidence(toolInsights.executions, 'commandBlueprint');
  return { data: result || {}, evidence };
}

async function generateArchitectureAssets({ assessment, report, capability }) {
  if (!OPENAI_API_KEY) {
    return {};
  }
  const payload = {
    assessment,
    report,
    capability
  };

  const toolInsights = await runToolPlanner({
    system: 'You are an enterprise architect preparing supporting evidence for architecture guidance.',
    payload
  });
  const plannerContext = {
    plan: toolInsights.plan || {},
    executions: toolInsights.executions || []
  };

  const result = await structuredOutput({
    system:
      'You are an enterprise architect producing board-ready blueprints. Return JSON conforming to the schema.',
    schema: ArchitectureAssetsSchema,
    messages: [
      { role: 'user', content: `Context:${JSON.stringify(payload)}` },
      { role: 'user', content: `Tool research:${JSON.stringify(plannerContext)}` }
    ]
  });

  return result || {};
}

async function generateFollowUpPrompts({ step, capability, answers, organization, industry }) {
  if (!OPENAI_API_KEY) {
    return { prompts: [] };
  }
  const payload = { step, capability, answers, organization, industry };
  const toolInsights = await runToolPlanner({
    system: 'You help the intake copilot identify gaps before crafting follow-up prompts.',
    payload
  });
  const result = await structuredOutput({
    system:
      "You are a senior transformation consultant embedded in Agama's assessment wizard. Suggest clarifying follow-up questions in JSON matching the schema.",
    schema: FollowUpSchema,
    messages: [
      { role: 'user', content: `Context:${JSON.stringify(payload)}` },
      { role: 'user', content: `Tool research:${JSON.stringify(toolInsights)}` }
    ]
  });
  if (!result) {
    return { prompts: [] };
  }
  return result;
}

async function generateAssessmentAssistantReply({ message, assessmentDraft, capability }) {
  if (!OPENAI_API_KEY) {
    return {
      answer: 'The assessment assistant is offline. Configure OPENAI_API_KEY to unlock contextual guidance and live Q&A.'
    };
  }
  const messages = [
    { role: 'system', content: "You are Agama Technologies' assessment copilot. Provide concise, actionable guidance grounded only in the provided assessment draft." },
    { role: 'user', content: `User question: ${message}\n\nContext JSON:${JSON.stringify({ capability, assessmentDraft })}` }
  ];
  const data = await openAIRequest({
    model: DEFAULT_MODEL,
    temperature: 0.4,
    messages
  });
  if (!data) {
    return { answer: 'No response available right now.' };
  }
  const content = extractMessageContent(data.choices?.[0]?.message) || 'No response available right now.';
  return { answer: content };
}

async function searchOrganizationProfiles({ query, capability, industry }) {
  if (!OPENAI_API_KEY) {
    return {
      matches: [],
      confidenceNote: 'Organisation enrichment disabled. Configure OPENAI_API_KEY to unlock auto-complete.'
    };
  }
  const payload = { query, capability, industry };
  const result = await structuredOutput({
    system:
      'You are an enterprise intelligence analyst. Return JSON that lists best match organisations with accurate metadata.',
    schema: OrganizationMatchSchema,
    messages: [
      {
        role: 'user',
        content: `Organisation lookup request. Query: ${query}. Relevant capability: ${capability}. Industry context: ${industry}.`
      }
    ]
  });
  if (!result) {
    return {
      matches: [],
      confidenceNote: 'Organisation enrichment disabled. Configure OPENAI_API_KEY to unlock auto-complete.'
    };
  }
  result.matches = Array.isArray(result.matches) ? result.matches : [];
  return result;
}

async function fetchOrganizationIntel({ organization, assessmentType, industry }) {
  if (!OPENAI_API_KEY) {
    return {
      summary: `External research for ${organization} unavailable. Configure OPENAI_API_KEY to enable automatic enrichment.`,
      dominantFrameworks: [],
      vendorSignals: [],
      profile: {
        canonicalName: organization,
        classification: 'Unknown',
        industryTags: [industry].filter(Boolean),
        dataConfidence: 'OpenAI enrichment disabled.',
        sources: []
      }
    };
  }
  const payload = { organization, assessmentType, industry };
  const result = await structuredOutput({
    system:
      'You synthesise analyst, regulatory, and funding intelligence for enterprise technology initiatives. Provide JSON matching the schema.',
    schema: OrganizationIntelSchema,
    messages: [
      {
        role: 'user',
        content: `Provide official perspectives and organisational intelligence for ${organization} focusing on ${assessmentType} programmes in the ${industry || 'cross-industry'} domain.`
      }
    ]
  });
  if (!result) {
    return {
      summary: `External research for ${organization} unavailable. Configure OPENAI_API_KEY to enable automatic enrichment.`,
      dominantFrameworks: [],
      vendorSignals: [],
      profile: {
        canonicalName: organization,
        classification: 'Unknown',
        industryTags: [industry].filter(Boolean),
        dataConfidence: 'OpenAI enrichment disabled.',
        sources: []
      }
    };
  }
  if (result.profile && Array.isArray(result.profile.industryTags) === false && result.profile.industryTags) {
    result.profile.industryTags = String(result.profile.industryTags)
      .split(/,|;|\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return result;
}

async function generateRfpDraft({ project, template, overrides = {}, assessment }) {
  if (!OPENAI_API_KEY) {
    return {
      capability: overrides.capability || template?.capability || 'Capability',
      industry: overrides.industry || template?.industry || project?.industry,
      criteria: overrides.criteria || template?.criteria || [],
      questions: overrides.questions || [],
      scoringRubric: overrides.scoringRubric || {},
      timeline: overrides.timeline || { phases: [], targetLaunch: undefined },
      stakeholders: overrides.stakeholders || []
    };
  }

  const base = {
    project: project
      ? {
          name: project.name,
          industry: project.industry,
          region: project.region,
          companySize: project.companySize,
          strategicDrivers: project.strategicDrivers,
          capabilityFocus: project.capabilityFocus
        }
      : {},
    template,
    overrides,
    assessment,
    scoreSummary: assessment
      ? getComputeScoreSummary()({
          answers: assessment.answers || {},
          vertical: assessment.vertical,
          companySize: assessment.companySize
        })
      : null
  };

  const toolInsights = await runToolPlanner({
    system: 'You are preparing procurement intelligence to build an RFP draft. Use tools for vendor alignment, scoring context, and ROI.',
    payload: base
  });

  const result = await structuredOutput({
    system: 'You are an enterprise sourcing strategist. Produce an RFP draft JSON that matches the schema exactly.',
    schema: RfpDraftSchema,
    messages: [
      { role: 'user', content: `Context:${JSON.stringify(base)}` },
      { role: 'user', content: `Tool research:${JSON.stringify(toolInsights)}` }
    ]
  });

  if (!result) {
    return {
      capability: overrides.capability || template?.capability || project?.capabilityFocus?.[0] || 'Capability',
      industry: overrides.industry || template?.industry || project?.industry,
      criteria: overrides.criteria || template?.criteria || [],
      questions: overrides.questions || [],
      scoringRubric: overrides.scoringRubric || {},
      timeline: overrides.timeline || { phases: [], targetLaunch: undefined },
      stakeholders: overrides.stakeholders || []
    };
  }
  return result;
}

async function callOpenAI({ system, user, responseFormat = { type: 'json_object' } }) {
  if (!OPENAI_API_KEY) {
    return null;
  }
  const messages = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  if (user) {
    messages.push({ role: 'user', content: user });
  }
  const data = await openAIRequest({
    model: DEFAULT_MODEL,
    temperature: 0.4,
    messages,
    response_format: responseFormat || undefined
  });
  if (!data) return null;
  const content = extractMessageContent(data.choices?.[0]?.message) || '';
  if (responseFormat?.type === 'json_object') {
    try {
      return JSON.parse(content);
    } catch (err) {
      console.warn('Failed to parse OpenAI JSON content', err);
      return null;
    }
  }
  return content;
}

module.exports = {
  callOpenAI,
  structuredOutput,
  toolCalling,
  generateExecutiveNarrative,
  generateStrategicIntelligence,
  generateCommandBlueprint,
  fetchOrganizationIntel,
  searchOrganizationProfiles,
  generateArchitectureAssets,
  generateFollowUpPrompts,
  generateAssessmentAssistantReply,
  generateRfpDraft,
  uploadFileToOpenAI,
  createVectorStore,
  attachFileToVectorStore,
  detachFileFromVectorStore,
  deleteOpenAIFile,
  executeRagQuery,
  ExecutiveNarrativeSchema,
  StrategicIntelligenceSchema,
  CommandBlueprintSchema,
  ArchitectureAssetsSchema,
  FollowUpSchema,
  RfpDraftSchema
};
