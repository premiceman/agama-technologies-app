const { createHmac, timingSafeEqual } = require('crypto');

let StripeConstructor;
let usingStub = false;

try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  StripeConstructor = require('stripe');
} catch (err) {
  usingStub = true;
  StripeConstructor = class StripeStub {
    constructor() {
      this.__agamaStub = true;
      this.webhooks = {
        constructEvent: (payload, header, secret) => {
          if (!secret) {
            throw new Error('Stripe webhook secret not configured');
          }
          const rawPayload = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload || '');
          const signatureHeader = String(header || '');
          const parts = signatureHeader.split(',');
          const timestampPart = parts.find(part => part.startsWith('t='));
          const signaturePart = parts.find(part => part.startsWith('v1='));
          if (!timestampPart || !signaturePart) {
            throw new Error('Invalid Stripe signature header');
          }
          const timestamp = timestampPart.split('=')[1];
          const signature = signaturePart.split('=')[1];
          const expected = createHmac('sha256', secret)
            .update(`${timestamp}.${rawPayload}`)
            .digest('hex');
          const provided = Buffer.from(signature, 'hex');
          const expectedBuffer = Buffer.from(expected, 'hex');
          if (
            expectedBuffer.length !== provided.length ||
            !timingSafeEqual(expectedBuffer, provided)
          ) {
            throw new Error('Stripe signature verification failed');
          }
          return JSON.parse(rawPayload);
        },
        generateTestHeaderString: ({ payload, secret, timestamp = Math.floor(Date.now() / 1000) }) => {
          if (!secret) {
            throw new Error('Stripe webhook secret not configured');
          }
          const rawPayload = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload || '');
          const signature = createHmac('sha256', secret)
            .update(`${timestamp}.${rawPayload}`)
            .digest('hex');
          return `t=${timestamp},v1=${signature}`;
        }
      };
      this.checkout = {
        sessions: {
          async create() {
            throw new Error('Stripe SDK is not installed in this environment.');
          }
        }
      };
      this.subscriptions = {
        async retrieve() {
          throw new Error('Stripe SDK is not installed in this environment.');
        }
      };
    }
  };
}

let stripeInstance = null;

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('Stripe secret key is not configured');
  }
  if (!stripeInstance) {
    stripeInstance = new StripeConstructor(secret, {
      apiVersion: process.env.STRIPE_API_VERSION || '2024-06-20'
    });
    if (usingStub) {
      stripeInstance.__agamaStub = true;
    }
  }
  return stripeInstance;
}

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function isStripeStub() {
  return Boolean(stripeInstance && stripeInstance.__agamaStub);
}

module.exports = { getStripe, isStripeConfigured, isStripeStub };
