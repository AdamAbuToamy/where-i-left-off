import specification from "../../docs/openapi-public-api.json";
export type Schema = {
  type?: string | string[];
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  allOf?: Schema[];
  oneOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  items?: Schema;
  description?: string;
  maxLength?: number;
};
type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  schema?: Schema;
};
type Operation = {
  operationId: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: {
    content: Record<
      string,
      {
        schema: Schema;
        examples?: Record<string, { value: Record<string, unknown> }>;
      }
    >;
  };
  responses: Record<
    string,
    { description: string; content?: Record<string, { schema: Schema }> }
  >;
};
export type ApiOperation = Operation & {
  path: string;
  method: string;
  id: string;
  scopes: string[];
  parameters: Parameter[];
};
type Contract = {
  info: { version: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, Operation | Parameter[]>>;
  components: { schemas: Record<string, Schema> };
};
export const contract = specification as unknown as Contract;
export const apiBase = contract.servers[0].url;
export const operations: ApiOperation[] = Object.entries(
  contract.paths,
).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([method]) =>
      ["get", "post", "patch", "put", "delete"].includes(method),
    )
    .map(([method, raw]) => {
      const op = raw as Operation;
      return {
        ...op,
        path,
        method: method.toUpperCase(),
        id: op.operationId,
        scopes: [
          ...new Set(op.description.match(/[a-z]+:(?:read|write)/g) || []),
        ],
        parameters: [
          ...((item.parameters as Parameter[]) || []),
          ...(op.parameters || []),
        ],
      };
    }),
);
export function resolveSchema(input: Schema): Schema {
  if (input.$ref) {
    const name = input.$ref.split("/").at(-1)!;
    return resolveSchema(contract.components.schemas[name]);
  }
  if (input.allOf) {
    const parts = input.allOf.map(resolveSchema);
    return {
      ...input,
      properties: Object.assign({}, ...parts.map((p) => p.properties || {})),
      required: [...new Set(parts.flatMap((p) => p.required || []))],
    };
  }
  return input;
}
export function sample(schema: Schema, key = ""): unknown {
  const s = resolveSchema(schema);
  if (s.const !== undefined) return s.const;
  if (s.enum) return s.enum[0];
  if (s.oneOf) return sample(s.oneOf[0], key);
  if (s.type === "object" || s.properties) {
    return Object.fromEntries(
      (s.required || []).map((k) => [k, sample(s.properties?.[k] || {}, k)]),
    );
  }
  if (s.type === "array") return [];
  if (s.type === "integer" || s.type === "number") return 0;
  if (s.type === "boolean") return false;
  if (key === "courseId") return "REPLACE_WITH_COURSE_ID";
  if (key === "time") return "09:00";
  if (key === "start") return "10:00";
  if (key === "end") return "11:00";
  if (key === "title") return "Example assignment";
  if (key === "name") return "Example course";
  return "";
}
export function operationBody(op: ApiOperation) {
  const media = op.requestBody?.content["application/json"];
  // Prefer an explicitly documented no-write preview over a fabricated union-schema example.
  if (media?.examples?.preview)
    return structuredClone(media.examples.preview.value);
  const schema = media?.schema;
  if (!schema) return undefined;
  const body = sample(schema) as Record<string, unknown>;
  if (
    ["requestTaskNotification", "requestProjectNotification"].includes(
      op.operationId,
    )
  )
    body.bypassQuietHours = false;
  if (op.operationId === "setCardReminder")
    Object.assign(body, { disabled: false, weekly: false, time: "09:00" });
  if (
    op.method === "PATCH" &&
    body.values &&
    typeof body.values === "object" &&
    !Object.keys(body.values).length
  ) {
    const valuesSchema = resolveSchema(
      resolveSchema(schema).properties!.values,
    );
    const name = ["name", "title", "room"].find(
      (k) => valuesSchema.properties?.[k],
    );
    if (name)
      (body.values as Record<string, unknown>)[name] =
        name === "room" ? "Room 204" : "Updated example";
  }
  return body;
}
export type CodeLanguage = "curl" | "python" | "javascript";
export const placeholder = "REPLACE_WITH_YOUR_API_KEY";
export function requestCode(op: ApiOperation, language: CodeLanguage) {
  const url =
    apiBase + op.path.replace(/\{[^}]+\}/g, "REPLACE_WITH_RESOURCE_ID");
  const body = operationBody(op),
    json = body === undefined ? undefined : JSON.stringify(body, null, 2),
    match = op.parameters.some((p) => p.name === "If-Match"),
    idem = op.parameters.some(
      (p) => p.in === "header" && p.name === "Idempotency-Key",
    );
  if (language === "curl")
    return `API_KEY="${"${WILO_API_KEY:-" + placeholder + "}"}"
curl --silent --show-error --fail-with-body \\
  --request ${op.method} '${url}' \\
  --header "Authorization: Bearer $API_KEY"${
    match
      ? ` \\
  --header 'If-Match: REPLACE_WITH_SETTINGS_VERSION'`
      : ""
  }${
    json
      ? ` \\
  --header 'Content-Type: application/json'`
      : ""
  }${
    idem
      ? ` \\
  --header 'Idempotency-Key: example-${op.id}-0001'`
      : ""
  }${
    json
      ? ` \\
  --data '${json}'`
      : ""
  }`;
  if (language === "python")
    return `# Setup once: python -m pip install requests
import os
import requests

api_key = os.environ.get("WILO_API_KEY", "${placeholder}")
headers = {"Authorization": f"Bearer {api_key}"}${match ? '\nheaders["If-Match"] = "REPLACE_WITH_SETTINGS_VERSION"' : ""}${
      idem
        ? `
headers["Idempotency-Key"] = "example-${op.id}-0001"`
        : ""
    }
response = requests.request(
    "${op.method}",
    "${url}",
    headers=headers,${
      json
        ? `
    json=${JSON.stringify(body)
      .replace(/:false/g, ":False")
      .replace(/:true/g, ":True")
      .replace(/:null/g, ":None")},`
        : ""
    }
    timeout=30,
)
if not response.ok:
    raise RuntimeError(f"Wilo HTTP {response.status_code}: {response.text}")
print(response.json())`;
  return `// Node.js 18+ / trusted server; keep credentials out of browser bundles.
const apiKey = process.env.WILO_API_KEY || "${placeholder}";
const response = await fetch("${url}", {
  method: "${op.method}",
  headers: {
    Authorization: \`Bearer ${"${apiKey}"}\`,${match ? '\n    "If-Match": "REPLACE_WITH_SETTINGS_VERSION",' : ""}${json ? '\n    "Content-Type": "application/json",' : ""}${
      idem
        ? `
    "Idempotency-Key": "example-${op.id}-0001",`
        : ""
    }
  },${
    json
      ? `
  body: JSON.stringify(${json}),`
      : ""
  }
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) {
  throw new Error(\`Wilo HTTP ${"${response.status}"}: ${"${await response.text()}"}\`);
}
console.log(await response.json());`;
}
export function workflowCode(language: CodeLanguage) {
  const list = operations.find((o) => o.operationId === "listCourses")!,
    create = operations.find((o) => o.operationId === "createTasks")!;
  const body = operationBody(create) as { values: Record<string, unknown> };
  if (!list || !create) throw Error("Documented workflow missing from OpenAPI");
  const json = JSON.stringify(body.values);
  if (language === "python")
    return `# Setup once: python -m pip install requests
import os
import uuid
import requests

base = "${apiBase}"
key = os.environ.get("WILO_API_KEY", "${placeholder}")
headers = {"Authorization": f"Bearer {key}"}
response = requests.get(base + "${list.path}", headers=headers, timeout=30)
response.raise_for_status()
courses = response.json()["result"]["items"]
if not courses:
    raise RuntimeError("Create a course first, then choose its ID.")
# Choose the intended course locally; do not assume the first course is correct.
course_id = "REPLACE_WITH_COURSE_ID_FROM_RESPONSE"
assert any(c["id"] == course_id for c in courses), "Select a course from the returned page"
values = ${json}
values["courseId"] = course_id
operation_id = str(uuid.uuid4())  # Save and reuse this ID if this exact operation is retried.
response = requests.post(base + "${create.path}", headers={**headers, "Idempotency-Key": operation_id}, json={"values": values}, timeout=30)
response.raise_for_status()
print(response.json())`;
  if (language === "javascript")
    return `// Node.js 18+ / trusted server
import { randomUUID } from "node:crypto";
const base = "${apiBase}";
const apiKey = process.env.WILO_API_KEY || "${placeholder}";
const headers = { Authorization: \`Bearer ${"${apiKey}"}\` };
const read = await fetch(base + "${list.path}", { headers, signal: AbortSignal.timeout(30000) });
if (!read.ok) throw new Error(\`Wilo HTTP ${"${read.status}"}\`);
const { result } = await read.json();
const courseId = "REPLACE_WITH_COURSE_ID_FROM_RESPONSE";
if (!result.items.some(c => c.id === courseId)) throw new Error("Choose a course ID from this page");
const values = ${json};
values.courseId = courseId;
const operationId = randomUUID(); // Save and reuse for retries of this exact operation.
const response = await fetch(base + "${create.path}", {
  method: "${create.method}",
  headers: { ...headers, "Content-Type": "application/json", "Idempotency-Key": operationId },
  body: JSON.stringify({ values }), signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(\`Wilo HTTP ${"${response.status}"}: ${"${await response.text()}"}\`);
console.log(await response.json());`;
  return (
    requestCode(list, "curl") +
    `

# Choose a course ID from result.items, then replace the courseId placeholder below.
# Continue pagination with nextCursor if needed.
` +
    requestCode(create, "curl")
  );
}

export function errorResponseCode(status: string) {
  const response = operations.find(
    (o) => o.responses[status]?.content?.["application/json"],
  )?.responses[status];
  const schema = response?.content?.["application/json"]?.schema;
  if (!schema) return "";
  const body = sample(schema) as Record<string, unknown>;
  for (const key of Object.keys(body))
    if (typeof body[key] === "string")
      body[key] =
        key === "error"
          ? "ERROR_CODE_FROM_RESPONSE"
          : "REQUEST_ID_FROM_RESPONSE";
  return `HTTP ${status}\n${JSON.stringify(body, null, 2)}`;
}

/** Routes come from the same published contract as the reference below. */
export function reminderWorkflowCode(language: CodeLanguage) {
  const write = operations.find(
    (op) => op.operationId === "createCardReminder",
  )!;
  const read = operations.find((op) => op.operationId === "listCardReminders")!;
  const url =
    apiBase + write.path.replace("{projectId}", "REPLACE_WITH_PROJECT_ID");
  const schedule = {
    mode: "relative",
    amount: 4,
    unit: "days",
    localTime: "09:00",
    timeZone: "Asia/Jerusalem",
  };
  if (language === "python")
    return `import os, uuid, requests
url = "${url}"
headers = {"Authorization": f"Bearer {os.environ['WILO_API_KEY']}"}
# Each POST adds one reminder. Save each key/body for timeout recovery.
for days in (4, 2):
    body = {"schedule": {"mode":"relative", "amount":days, "unit":"days",
                        "localTime":"09:00", "timeZone":"Asia/Jerusalem"}}
    operation_key = str(uuid.uuid4())
    response = requests.post(url, headers={**headers, "Idempotency-Key":operation_key}, json=body, timeout=30)
    response.raise_for_status()
    print(response.json()["result"]["id"])
response = requests.get(url, headers=headers, timeout=30)
response.raise_for_status()
print(response.json())`;
  if (language === "javascript")
    return `import { randomUUID } from "node:crypto";
const url = "${url}";
const headers = {Authorization: \`Bearer ${"${process.env.WILO_API_KEY}"}\`};
// Save each key/body for timeout recovery. Do not generate a new key on retry.
for (const amount of [4,2]) {
  const body = {schedule:{mode:"relative",amount,unit:"days",localTime:"09:00",timeZone:"Asia/Jerusalem"}};
  const operationKey = randomUUID();
  const response = await fetch(url,{method:"POST",headers:{...headers,"Content-Type":"application/json","Idempotency-Key":operationKey},body:JSON.stringify(body)});
  if(!response.ok) throw new Error(\`Wilo HTTP ${"${response.status}"}\`);
  console.log((await response.json()).result.id);
}
const response = await fetch(url,{headers});
if(!response.ok) throw new Error(\`Wilo HTTP ${"${response.status}"}\`);
console.log(await response.json());`;
  return (
    [4, 2]
      .map(
        (amount) => `# Keep this operation key and body unchanged for retries.
curl --fail-with-body --request POST '${url}' \\
  --header 'Authorization: Bearer ${placeholder}' \\
  --header 'Content-Type: application/json' \\
  --header 'Idempotency-Key: REPLACE_WITH_STABLE_OPERATION_ID_${amount}' \\
  --data '${JSON.stringify({ schedule: { ...schedule, amount } })}'`,
      )
      .join("\n\n") +
    "\n\n" +
    requestCode(read, "curl")
  );
}
