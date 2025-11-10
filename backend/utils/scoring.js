export const scoreAssessment = (model, responses = []) => {
  const definition =
    model?.definition ||
    (Array.isArray(model?.schema?.sections) ? model.schema : null);
  if (!definition?.sections) {
    return { bySection: {}, overall: 0 };
  }
  const sectionScores = {};
  let totalWeight = 0;
  let weightedScore = 0;

  definition.sections.forEach((section) => {
    const sectionWeight = section.weight || 1;
    const questionScores = section.questions.map((question) => {
      const response = responses.find((r) => r.questionId === question.id);
      const numericValue =
        typeof response?.value === 'number' ? response.value : 0;
      return numericValue;
    });
    const avg =
      questionScores.length > 0
        ? questionScores.reduce((sum, value) => sum + value, 0) /
          questionScores.length
        : 0;
    sectionScores[section.id] = {
      title: section.title,
      score: avg
    };
    totalWeight += sectionWeight;
    weightedScore += avg * sectionWeight;
  });

  const overall = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return { bySection: sectionScores, overall };
};
