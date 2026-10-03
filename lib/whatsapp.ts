type TextMessage = {
  to: string;
  type: "text";
  text: { body: string };
};

type TemplateMessage = {
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: unknown[];
  };
};

async function graphRequest(body: Record<string, unknown>) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION;

  if (!token || !phoneNumberId || !version) {
    throw new Error("WHATSAPP_ENV_MISSING");
  }

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`META_API_ERROR:${JSON.stringify(data)}`);
  return data;
}

export function sendText(message: TextMessage) {
  return graphRequest(message);
}

export function sendTemplate(message: TemplateMessage) {
  return graphRequest(message);
}
