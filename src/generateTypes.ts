import {
  getJsdoc,
  getRefName,
  getSchemaName,
  getTsType,
  isAscending,
} from "./utils";
import type { Schema, SwaggerConfig, TypeAST } from "./types";
import { AUTOGENERATED_COMMENT } from "./strings";

function generateTypes(
  types: TypeAST[],
  config: Partial<SwaggerConfig>,
): string {
  let code = AUTOGENERATED_COMMENT;
  try {
    code += types
      .sort(({ name }, { name: _name }) => isAscending(name, _name))
      .reduce((prev, { name: _name, schema, description }) => {
        const name = getSchemaName(_name);
        prev += `
        ${getJsdoc({
          description: {
            ...schema,
            description: description || schema?.description,
          },
          tags: {
            deprecated: {
              value: Boolean(schema?.deprecated),
              description: schema?.["x-deprecatedMessage"],
            },
            example: schema?.example,
          },
        })}
        ${getTypeDefinition(name, schema, config)}
        `;

        return prev;
      }, "");

    return code;
  } catch (error) {
    console.error({ error });
    return "";
  }
}

function getTypeDefinition(
  name: string,
  schema: Schema = {},
  { generateEnumAsType }: Partial<SwaggerConfig>,
) {
  const {
    type,
    enum: Enum,
    "x-enumNames": enumNames,
    allOf,
    oneOf,
    items,
    $ref,
    additionalProperties,
    properties,
  } = schema;

  if (Enum) {
    if (generateEnumAsType) {
      return `export type ${name} =${Enum.map((e) => `"${e}"`).join(" | ")};`;
    }
    return `export enum ${name} {${Enum.map(
      (e, index) =>
        `${enumNames ? enumNames[index] : e}=${
          typeof e === "string" ? `"${e}"` : `${e}`
        }`,
    )}}`;
  }

  if (allOf || oneOf) {
    return `export type ${name} = ${getTsType(schema)}`;
  }

  if (type === "array" && items) {
    return `export type ${name} = ${getTsType(items)}[]`;
  }

  if ($ref) {
    return `export type ${name} = ${getRefName($ref)}`;
  }

  if (type === "object") {
    const typeObject = getTsType(schema);

    if ((additionalProperties || properties) && !oneOf) {
      return `export interface ${name} ${typeObject}`;
    }

    return `export type ${name} = ${typeObject}`;
  }

  return `export type ${name} = any`;
}

export { generateTypes };
