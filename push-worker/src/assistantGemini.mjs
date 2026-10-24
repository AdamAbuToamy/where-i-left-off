import {actionFields,controlFields} from './assistantContract.mjs';
/** Gemini needs named properties for nested objects. The full target-specific validator still runs locally. */
function fieldsUnion(groups){
 const fields={};
 for(const group of Object.values(groups))for(const [name,schema] of Object.entries(group)){
  const old=fields[name];
  if(!old){fields[name]=structuredClone(schema);continue;}
  if(old.type!==schema.type)throw new Error('ai-invalid-tool-schema');
  if(old.enum&&schema.enum)old.enum=[...new Set([...old.enum,...schema.enum])];
  if(old.maxLength!==undefined&&schema.maxLength!==undefined)old.maxLength=Math.max(old.maxLength,schema.maxLength);
 }
 return fields;
}
function googleSchema(schema){
 // OpenAI compatibility translates to Google's OpenAPI Schema subset, not arbitrary JSON Schema.
 const next={type:schema.type};
 if(schema.description)next.description=schema.description;
 if(schema.enum?.every(v=>typeof v==='string'))next.enum=schema.enum;
 if(schema.properties)next.properties=Object.fromEntries(Object.entries(schema.properties).map(([name,value])=>[name,googleSchema(value)]));
 if(schema.required)next.required=schema.required;
 if(schema.items)next.items=googleSchema(schema.items);
 return next;
}
export function geminiTools(tools){
 return tools.map(tool=>{
  const result=structuredClone(tool);
  if(tool.function?.name!=='propose_workspace_actions'){result.function.parameters=googleSchema(result.function.parameters);return result;}
  const properties=result.function.parameters.properties;
  properties.actions.items.properties.values={type:'object',additionalProperties:false,properties:fieldsUnion(actionFields)};
  properties.controls.items.properties.values={type:'object',additionalProperties:false,properties:fieldsUnion(controlFields)};
  result.function.parameters=googleSchema(result.function.parameters);
  return result;
 });
}
/** Match known upstream diagnostics, returning fixed labels only, never response text or a key. */
export function geminiFailure(failure){
 const text=String(failure?.message||''),reasons=(Array.isArray(failure?.details)?failure.details:[]).map(d=>d?.reason);
 const code={INVALID_ARGUMENT:'invalid_argument',PERMISSION_DENIED:'permission_denied',UNAUTHENTICATED:'invalid_api_key',NOT_FOUND:'model_not_found',RESOURCE_EXHAUSTED:'rate_limit_exceeded'}[failure?.status];
 if(reasons.includes('API_KEY_INVALID')||/API key not valid|API_KEY_INVALID/i.test(text))return {code:'invalid_api_key',hint:'api-key-invalid'};
 if(/properties[^\n]*should be non.empty for OBJECT/i.test(text))return {code:code||'invalid_request_error',hint:'empty-object-schema',parameter:'tools'};
 if(/(?:Unknown name|unsupported|not supported)[\s\S]*(?:additionalProperties|parameters|schema)/i.test(text))return {code:code||'invalid_request_error',hint:'unsupported-tool-schema',parameter:'tools'};
 if(/(?:reasoning_effort|thinking)[\s\S]*(?:unsupported|not supported|invalid|unknown)/i.test(text))return {code:code||'invalid_request_error',hint:'unsupported-reasoning',parameter:'reasoning_effort'};
 return {code};
}
