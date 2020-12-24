import {
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
} from "fs";
import { format } from "prettier";
import { SwaggerJson, SwaggerConfig } from "./types";
import { HTTP_REQUEST, CONFIG } from "./strings";
import { getJson } from "./getJson";
import { generator } from "./generator";
import { build } from "tsc-prog";
import { majorVersionsCheck } from "./utils";
import { HubJson, signalRGenerator } from "./signalR/generator";

async function generate() {
  const config: SwaggerConfig = getSwaggerConfig();

  const {
    url,
    hub,
    dir,
    prettierPath,
    language,
    //@ts-ignore
    __unstable_is_legacy_properties,
  } = config;
  //@ts-ignore
  global.__unstable_is_legacy_properties = __unstable_is_legacy_properties;

  const isToJs = language === "javascript";

  if (!existsSync(dir)) {
    mkdirSync(dir);
  }

  const prettierOptions = getPrettierOptions(prettierPath);

  try {
    const input: SwaggerJson = await getJson(url);

    // signalR hub definition
    let hubCode = null;
    if (hub) {
      const hubJson: HubJson = hub ? await getJson(hub) : null;

      hubCode = signalRGenerator(hubJson);
    }

    majorVersionsCheck("3.0.0", input.openapi);

    const code = generator(input, config);

    writeFileSync(`${dir}/services.ts`, code);

    writeFileSync(`${dir}/httpRequest.ts`, HTTP_REQUEST);

    if (!existsSync(`${dir}/config.${isToJs ? "js" : "ts"}`)) {
      writeFileSync(
        `${dir}/config.ts`,
        CONFIG.replace(
          "${AUTO_REPLACE_BASE_URL}",
          input.servers?.[0].url || "",
        ),
      );
    }

    hubCode && writeFileSync(`${dir}/hub.ts`, hubCode);

    if (isToJs) {
      convertTsToJs(dir);
      hubCode && formatFile(`${dir}/hub.js`, prettierOptions);
      formatFile(`${dir}/config.js`, prettierOptions);
      formatFile(`${dir}/httpRequest.js`, prettierOptions);
      formatFile(`${dir}/services.js`, prettierOptions);
      formatFile(`${dir}/config.d.ts`, prettierOptions);
      formatFile(`${dir}/httpRequest.d.ts`, prettierOptions);
      formatFile(`${dir}/services.d.ts`, prettierOptions);
      hubCode && formatFile(`${dir}/hub.d.ts`, prettierOptions);
    } else {
      hubCode && formatFile(`${dir}/hub.ts`, prettierOptions);
      formatFile(`${dir}/config.ts`, prettierOptions);
      formatFile(`${dir}/httpRequest.ts`, prettierOptions);
      formatFile(`${dir}/services.ts`, prettierOptions);
    }
  } catch (error) {
    console.error(error);
  }
}

function formatFile(filePath: string, prettierOptions: any) {
  const code = readFileSync(filePath).toString();
  writeFileSync(filePath, format(code, prettierOptions));
}

function convertTsToJs(dir: string) {
  build({
    basePath: ".", // always required, used for relative paths
    compilerOptions: {
      listFiles: true,
      outDir: dir,
      declaration: true,
      skipLibCheck: true,
      module: "esnext",
      target: "esnext",
      lib: ["esnext"],
    },
    files: [`${dir}/services.ts`, `${dir}/hub.ts`],
  });

  if (existsSync(`${dir}/config.ts`)) {
    rmdirSync(`${dir}/config.ts`, { recursive: true });
  }

  if (existsSync(`${dir}/services.ts`)) {
    rmdirSync(`${dir}/services.ts`, { recursive: true });
  }

  if (existsSync(`${dir}/httpRequest.ts`)) {
    rmdirSync(`${dir}/httpRequest.ts`, { recursive: true });
  }

  if (existsSync(`${dir}/hub.ts`)) {
    rmdirSync(`${dir}/hub.ts`, { recursive: true });
  }
}

function getSwaggerConfig() {
  try {
    const config = JSON.parse(readFileSync("swagger.config.json").toString());

    if (!config) {
      throw "";
    }

    return config;
  } catch (error) {
    try {
      return JSON.parse(readFileSync("./swaggerConfig.json").toString()); // backward compatible for  v1
    } catch {
      throw new Error("Please define swagger.config.json");
    }
  }
}

function getPrettierOptions(prettierPath?: string) {
  let prettierOptions: any = {};
  if (prettierPath && existsSync(prettierPath)) {
    prettierOptions = JSON.parse(readFileSync(prettierPath).toString());
  } else {
    if (existsSync(".prettierrc")) {
      prettierOptions = JSON.parse(readFileSync(".prettierrc").toString());
    } else if (existsSync("prettier.json")) {
      prettierOptions = JSON.parse(readFileSync("prettier.json").toString());
    }
  }

  if (!prettierOptions.parser) {
    prettierOptions.parser = "typescript";
  }

  return prettierOptions;
}

generate();

export { generate };
