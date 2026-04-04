# Custom Function Tools Guide

## Overview

Function tools allow your AI agent to take actions during calls beyond just conversation. This guide shows you how to create custom tools for your specific use case.

## Built-in Tools

The system includes these ready-to-use tools:

| Tool | Purpose | Parameters |
|------|---------|-----------|
| `checkCalendar` | Check Cal.com availability | `date`, `timezone` |
| `bookAppointment` | Book Cal.com appointment | `date`, `time`, `email`, `name` |
| `lookupContact` | Find contact in CRM | `phone_number` |
| `updateContact` | Update contact fields | `contact_id`, `fields` |
| `sendSMS` | Send SMS via Twilio | `to`, `message` |
| `transferCall` | Transfer to human rep | `to_number` |

## Creating a Custom Tool

### Step 1: Define Tool Schema

Create tool definition in `lib/function-tools.ts`:

```typescript
// lib/function-tools.ts
export const customTools = [
  {
    name: 'checkInventory',
    description: 'Check if a product is in stock',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product SKU or ID',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to check',
          default: 1,
        },
      },
      required: ['product_id'],
    },
  },
];
```

### Step 2: Implement Tool Handler

Create API route handler:

```typescript
// app/api/tools/check-inventory/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { product_id, quantity = 1 } = await req.json();

    // Validate parameters
    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id is required' },
        { status: 400 }
      );
    }

    // Call your inventory system
    const inventory = await checkInventorySystem(product_id);

    // Return result
    if (inventory.quantity >= quantity) {
      return NextResponse.json({
        in_stock: true,
        quantity: inventory.quantity,
        message: `We have ${inventory.quantity} units available`,
      });
    } else {
      return NextResponse.json({
        in_stock: false,
        quantity: 0,
        message: 'This item is currently out of stock',
      });
    }
  } catch (error) {
    console.error('[checkInventory] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check inventory' },
      { status: 500 }
    );
  }
}

async function checkInventorySystem(productId: string) {
  // Replace with your actual inventory API
  const response = await fetch(`https://your-inventory-api.com/products/${productId}`);
  return response.json();
}
```

### Step 3: Register Tool with Vapi

```typescript
// lib/vapi.ts
import Vapi from '@vapi-ai/server-sdk';

const vapi = new Vapi({ apiKey: process.env.VAPI_API_KEY! });

export async function createAssistantWithCustomTools(personaConfig: any) {
  const assistant = await vapi.assistants.create({
    name: personaConfig.name,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      functions: [
        // Built-in tools
        {
          name: 'checkCalendar',
          description: 'Check calendar availability',
          parameters: {...},
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/check-calendar`,
        },
        // Custom tool
        {
          name: 'checkInventory',
          description: 'Check if a product is in stock',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              quantity: { type: 'number', default: 1 },
            },
            required: ['product_id'],
          },
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/check-inventory`,
        },
      ],
    },
    voice: {
      provider: '11labs',
      voiceId: personaConfig.voice_id,
    },
  });

  return assistant;
}
```

### Step 4: Configure in Persona

```typescript
// When creating persona
await db.insert('personas', {
  name: 'E-commerce Agent',
  system_prompt: `
    You are a helpful e-commerce agent.
    When the caller asks about product availability, use the checkInventory tool.
    Example: "Is product ABC123 in stock?"
    You should call: checkInventory({product_id: "ABC123", quantity: 1})
  `,
  tools: ['checkCalendar', 'bookAppointment', 'checkInventory'],
  // ...
});
```

## Example Custom Tools

### 1. Check Order Status

```typescript
// app/api/tools/check-order/route.ts
export async function POST(req: NextRequest) {
  const { order_id } = await req.json();

  const order = await fetch(`https://your-api.com/orders/${order_id}`).then(r => r.json());

  return NextResponse.json({
    status: order.status,
    tracking_number: order.tracking_number,
    estimated_delivery: order.estimated_delivery,
    message: `Your order is ${order.status}. Estimated delivery: ${order.estimated_delivery}`,
  });
}

// Tool definition
{
  name: 'checkOrder',
  description: 'Check the status of a customer order',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'The order number or ID',
      },
    },
    required: ['order_id'],
  },
}
```

### 2. Calculate Quote

```typescript
// app/api/tools/calculate-quote/route.ts
export async function POST(req: NextRequest) {
  const { service_type, duration_months, add_ons } = await req.json();

  const basePrice = SERVICE_PRICES[service_type];
  const discountRate = duration_months >= 12 ? 0.15 : 0;
  const addOnsTotal = add_ons.reduce((sum, addon) => sum + ADDON_PRICES[addon], 0);

  const total = (basePrice * duration_months * (1 - discountRate)) + addOnsTotal;

  return NextResponse.json({
    service_type,
    duration_months,
    base_price: basePrice,
    discount_rate: discountRate,
    add_ons_total: addOnsTotal,
    total,
    message: `Your total for ${duration_months} months of ${service_type} is $${total.toFixed(2)}`,
  });
}

// Tool definition
{
  name: 'calculateQuote',
  description: 'Calculate a price quote for services',
  parameters: {
    type: 'object',
    properties: {
      service_type: {
        type: 'string',
        enum: ['basic', 'pro', 'enterprise'],
        description: 'The service tier',
      },
      duration_months: {
        type: 'number',
        description: 'Contract duration in months',
        minimum: 1,
      },
      add_ons: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional features',
      },
    },
    required: ['service_type', 'duration_months'],
  },
}
```

### 3. Create Support Ticket

```typescript
// app/api/tools/create-ticket/route.ts
export async function POST(req: NextRequest) {
  const { title, description, priority, contact_email } = await req.json();

  // Create ticket in your helpdesk system
  const ticket = await fetch('https://helpdesk-api.com/tickets', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.HELPDESK_API_KEY}` },
    body: JSON.stringify({ title, description, priority, contact_email }),
  }).then(r => r.json());

  return NextResponse.json({
    ticket_id: ticket.id,
    ticket_url: ticket.url,
    message: `I've created ticket #${ticket.id} for you. You'll receive an email with updates.`,
  });
}

// Tool definition
{
  name: 'createTicket',
  description: 'Create a support ticket for the caller',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Brief summary of the issue',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the issue',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        description: 'Ticket priority',
        default: 'medium',
      },
      contact_email: {
        type: 'string',
        description: 'Email for ticket updates',
      },
    },
    required: ['title', 'description'],
  },
}
```

### 4. Lookup Account Balance

```typescript
// app/api/tools/lookup-balance/route.ts
export async function POST(req: NextRequest) {
  const { account_number } = await req.json();

  // Lookup in your billing system
  const account = await db.query('SELECT * FROM accounts WHERE account_number = $1', [account_number]);

  if (account.rows.length === 0) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const balance = account.rows[0].balance;
  const due_date = account.rows[0].due_date;

  return NextResponse.json({
    account_number,
    balance,
    due_date,
    message: `Your current balance is $${balance.toFixed(2)}, due on ${due_date}`,
  });
}

// Tool definition
{
  name: 'lookupBalance',
  description: 'Lookup account balance for a customer',
  parameters: {
    type: 'object',
    properties: {
      account_number: {
        type: 'string',
        description: 'The customer account number',
      },
    },
    required: ['account_number'],
  },
}
```

### 5. Schedule Callback

```typescript
// app/api/tools/schedule-callback/route.ts
export async function POST(req: NextRequest) {
  const { phone_number, preferred_time, reason } = await req.json();

  // Create callback task
  await db.insert('callback_queue', {
    phone_number,
    preferred_time: new Date(preferred_time),
    reason,
    status: 'pending',
    created_at: new Date(),
  });

  return NextResponse.json({
    scheduled: true,
    time: preferred_time,
    message: `I've scheduled a callback for ${preferred_time}. We'll call you then.`,
  });
}

// Tool definition
{
  name: 'scheduleCallback',
  description: 'Schedule a callback at a specific time',
  parameters: {
    type: 'object',
    properties: {
      phone_number: {
        type: 'string',
        description: 'Phone number to call back',
      },
      preferred_time: {
        type: 'string',
        description: 'Preferred callback time (ISO 8601 format)',
      },
      reason: {
        type: 'string',
        description: 'Reason for callback',
      },
    },
    required: ['phone_number', 'preferred_time'],
  },
}
```

## Best Practices

### Tool Design

**✅ Do:**
- Keep tool names descriptive and action-oriented (`checkInventory`, `bookAppointment`)
- Provide clear descriptions for LLM to understand when to use
- Use specific parameter types (`enum` for fixed choices, `minimum`/`maximum` for numbers)
- Return structured data AND a human-readable message
- Handle errors gracefully with helpful error messages

**❌ Don't:**
- Use generic names (`getData`, `doThing`)
- Require too many parameters (max 5 recommended)
- Return only machine-readable data (LLM needs human context)
- Assume parameters are valid (always validate)
- Expose sensitive internal details in errors

### Parameter Validation

**Always validate:**

```typescript
export async function POST(req: NextRequest) {
  const { product_id, quantity } = await req.json();

  // Required parameter check
  if (!product_id) {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  }

  // Type validation
  if (typeof quantity !== 'number' || quantity < 1) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
  }

  // Format validation
  if (!/^[A-Z0-9]{6,12}$/.test(product_id)) {
    return NextResponse.json({ error: 'Invalid product_id format' }, { status: 400 });
  }

  // Proceed...
}
```

### Response Format

**Standard response structure:**

```typescript
return NextResponse.json({
  // Machine-readable data
  success: true,
  data: {
    quantity: 10,
    price: 99.99,
    in_stock: true,
  },

  // Human-readable message (LLM uses this)
  message: 'We have 10 units in stock at $99.99 each',

  // Optional: Suggested next steps
  suggested_actions: [
    { action: 'bookAppointment', label: 'Schedule a demo' },
    { action: 'sendSMS', label: 'Send product details via SMS' },
  ],
});
```

### Error Handling

**Return user-friendly errors:**

```typescript
try {
  const result = await externalAPI.call();
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('[Tool Error]:', error);

  // Return helpful error, not technical details
  return NextResponse.json({
    success: false,
    error: 'Unable to check inventory right now. Please try again.',
    // Don't expose: error.stack, API keys, internal paths
  }, { status: 500 });
}
```

### Tool Logging

**Log tool calls for debugging:**

```typescript
export async function POST(req: NextRequest) {
  const params = await req.json();

  // Log tool call
  await db.insert('tool_logs', {
    tool_name: 'checkInventory',
    parameters: params,
    called_at: new Date(),
    call_id: req.headers.get('x-call-id'),
  });

  // Execute tool...
  const result = await executeToolLogic(params);

  // Log result
  await db.update('tool_logs', {
    result,
    completed_at: new Date(),
  });

  return NextResponse.json(result);
}
```

### Testing Tools

**Test tool independently:**

```bash
curl -X POST https://your-app.vercel.app/api/tools/check-inventory \
  -H "Content-Type: application/json" \
  -d '{"product_id": "ABC123", "quantity": 2}'
```

**Expected response:**
```json
{
  "in_stock": true,
  "quantity": 10,
  "message": "We have 10 units available"
}
```

**Test with persona:**

1. Create test persona with custom tool
2. Make test call
3. Trigger tool by saying: "Is product ABC123 in stock?"
4. Verify agent calls tool correctly
5. Check transcript for agent's response

## Advanced: Tool Chaining

**Allow agent to call multiple tools in sequence:**

**Example: Check stock → Calculate quote → Book appointment**

```typescript
// Persona system prompt
const systemPrompt = `
You are a sales agent. When a customer expresses interest:

1. First, check if the product is in stock using checkInventory
2. If in stock, calculate a quote using calculateQuote
3. If customer wants to proceed, book an appointment using bookAppointment

Example conversation flow:
User: "I'm interested in product ABC123"
You: [Call checkInventory] "Great! We have 10 units in stock. Let me calculate a quote for you."
You: [Call calculateQuote] "For a 12-month contract, the total is $1,200. Would you like to schedule a call to discuss?"
User: "Yes, tomorrow at 2pm works"
You: [Call bookAppointment] "Perfect! I've booked you for 2pm tomorrow. You'll receive a confirmation email."
`;
```

## Troubleshooting

### Tool not being called

**Symptoms:**
- Agent doesn't use tool even when appropriate
- Agent says "I can't do that"

**Solutions:**
1. **Improve tool description** (make it more obvious when to use)
   ```typescript
   description: 'Check product inventory. Use this when caller asks about stock availability, product quantity, or if an item is in stock.'
   ```
2. **Add examples to system prompt**
   ```
   When caller asks: "Do you have X in stock?"
   You MUST call: checkInventory({product_id: X})
   ```
3. **Verify tool is registered** with Vapi assistant
4. **Check tool URL** is correct and publicly accessible

### Tool called with wrong parameters

**Symptoms:**
- Tool receives invalid or missing parameters
- 400 errors in logs

**Solutions:**
1. **Add parameter descriptions:**
   ```typescript
   product_id: {
     type: 'string',
     description: 'The product SKU (e.g., "ABC123"). Found in the product catalog.'
   }
   ```
2. **Use enums for fixed choices:**
   ```typescript
   priority: {
     type: 'string',
     enum: ['low', 'medium', 'high'],
     description: 'Ticket priority'
   }
   ```
3. **Add defaults:**
   ```typescript
   quantity: {
     type: 'number',
     default: 1,
     description: 'Quantity to check'
   }
   ```

### Tool returns error

**Check:**
1. Tool endpoint is reachable: `curl https://your-app.vercel.app/api/tools/your-tool`
2. External API credentials are valid
3. Parameters are validated correctly
4. Error handling returns 200 with error message (not 500)

## Next Steps

- [Function Tools Reference](./lib/function-tools.ts) - See all built-in tools
- [Persona Builder Guide](./PERSONA-GUIDE.md) - Configure personas with tools
- [API Reference](./API-REFERENCE.md) - API endpoint documentation
- [Troubleshooting](./TROUBLESHOOTING.md) - Fix tool issues
