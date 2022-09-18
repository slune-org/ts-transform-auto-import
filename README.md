[![npm package](https://badge.fury.io/js/ts-transform-auto-import.svg)](https://www.npmjs.com/package/ts-transform-auto-import)
[![License](https://img.shields.io/github/license/slune-org/ts-transform-auto-import.svg)](https://github.com/slune-org/ts-transform-auto-import/blob/master/LICENSE)
[![Build Status](https://travis-ci.org/slune-org/ts-transform-auto-import.svg?branch=master)](https://travis-ci.org/slune-org/ts-transform-auto-import)
[![Coverage Status](https://coveralls.io/repos/github/slune-org/ts-transform-auto-import/badge.svg?branch=master)](https://coveralls.io/github/slune-org/ts-transform-auto-import?branch=master)
[![Issues](https://img.shields.io/github/issues/slune-org/ts-transform-auto-import.svg)](https://github.com/slune-org/ts-transform-auto-import/issues)

# ts-transform-auto-import - Typescript transformer used to import all files matching a pattern

This transformer fills in a variable initializer in a file with the content of files matching a glob. For example, with this file structure:

    .
    └── themes/
        ├── index.ts
        ├── dark.ts
        ├── magic.ts
        └── partial/
            ├── light.ts
            └── stars.ts

and this file content:

```typescript
// themes/index.ts
import { Theme, createTheme } from '../Theme/index.js'

const allThemes: { [name: string]: Theme } = {}

Object.entries(allThemes).forEach(([name, theme]) => createTheme(name, theme))
```

the transformer will fill in the `allThemes` variable so the file will be:

```typescript
// themes/index.ts
import dark_js_1 from './dark.js'
import magic_js_1 from './magic.js'
import light_js_1 from './partial/light.js'
import stars_js_1 from './partial/stars.js'
import { Theme, createTheme } from '../Theme/index.js'

const allThemes: { [name: string]: Theme } = {
  'dark.ts': dark_js_1,
  'magic.ts': magic_js_1,
  'partial/light.ts': light_js_1,
  'partial/stars.ts': stars_js_1,
}

Object.entries(allThemes).forEach(([name, theme]) => createTheme(name, theme))
```

# Language/langue

Documents, messages, code (including variable names and comments), are in English.

Anyway, because Slune is French firm, all documents and important messages must also be provided in French. Other translations are welcome.

:fr: Une version française de ce document se trouve [ici](doc/fr/README.md).

# Installation

Installation is done using `npm install` command:

```bash
$ npm install --save-dev ts-transform-auto-import
```

# Why would I need that?

You have an extensible application in which you can drop some locales, plugins, loaders, themes or whatever you want, and you need a place to import them all (probably an index file) for they are available in the application. How can you deal with that?

- You can manually update the aggregation file each time you create a new extension file… provided that you don't forget! In big organizations, it is rather easy to forget and even don't notice it, so that the added file will never be used.
- You can read and import the files at runtime. This will need to code the file search process, which will consume time. There even may be some situations where it would not work (e.g. if the module is executed in a web browser).
- You may write a tool which creates the index file at build time. In order not to forget it, you should add it to your build process. But you will also need to provide at least a fake aggregation file in order for _TypeScript_ to be able to check types, or for the unit tests.

Using the transformer, you will not need to do any of that. Simply write your aggregation file, which contains an initialized variable. You can even put fake initialization in there, if you need it for tests, it will be replaced by the transformer. Once this is done, you can add your extension files, and they will be automatically added to the variable.

This transformer is especially designed for ES modules. If you want to build CommonJS modules, rather look at [ts-transform-auto-require](https://github.com/slune-org/ts-transform-auto-require).

# Usage

The transformer holds its configuration under the `autoImports` parameter, which is an array of objects containing:

- `source`: the definition of the source, the files to be required — this is a mandatory object containing:
  - `glob`: the [glob](https://www.npmjs.com/package/glob) format used to select files, relative to project root — this parameter is mandatory;
  - `ignore`: either a string or an array of strings for the files to ignore — the value is directly given to the `ignore` option of [glob](https://www.npmjs.com/package/glob) — this parameter is optional.
- `target`: the definition of the target, where variable to be initialized will be found — this is a mandatory object containing:
  - `file`: the name of the file containing the variable (mandatory);
  - `variable`: the name of the variable to initialize with the `import`s (mandatory);
  - `extensionRewrite`: a dictionnary of source extensions and the value they will be converted into when compiled — default is `{ ts: 'js', tsx: 'jsx' }`.

There is currently no way of declaring a transformer in the vanilla _TypeScript_ compiler. If you do not want to write your own compiler using the `typescript` API, you can use the [ttypescript](https://www.npmjs.com/package/ttypescript) wrapper.

## Automatic fill-in

The code part to fill in by the transformer has to follow those rules:

- it **must** be a variable declaration, using `const`, `let`, or `var`;
- the variable name **may** be followed by a type definition;
- the variable **must** be followed by an immediate initialization;
- the initialization value **must** be an object literal;
- the initialization object **can** be empty or not;
- the initialization **may** be followed by a type cast.

All the below variable declarations are suitable for automatic filling:

```typescript
const allThemes: { [name: string]: Theme } = {}
let loaders = {} as { [name: string]: Loader; default: Loader }
var myVar = { fake: 'Fake testing value' }
```

## Imported file names

Imported file paths are treated like that:

- the file name (with path) is taken relatively to the target file;
- the extension is converted if in the `extensionRewrite` parameter (needed for, for example, _TypeScript_ `.ts` files which are transpiled into `.js` at runtime) for the import;
- the original extension is used in the key of the variable.

For example, in an index file collecting files in the same directory, the entry key is then simply the base name of the file, before compilation. If the file is in a subfolder, the subfolder name will also be present (e.g. `subfolder/file`). If we must climb up a folder (or more) to reach the file, the entry key will start with `..`.

## Configuration with ttypescript

For `ttypescript`, configure your `tsconfig.json`. Example:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "ts-transform-auto-import",
        "autoImports": [
          {
            "source": {
              "glob": "themes/**/*.ts",
              "ignore": ["**/index.ts", "**/*.spec.ts"]
            },
            "target": {
              "file": "themes/index.ts",
              "variable": "allThemes"
            }
          },
          {
            "source": { "glob": "**/loader-*.mts" },
            "target": {
              "file": "loader.ts",
              "variable": "loaders",
              "extensionRewrite": { "mts": "mjs" }
            }
          }
        ]
      }
    ]
  }
}
```

The transformer is of type `program` (which is the default for `ttypescript`).

# Notices

- The same file name, and even the same full target can appear multiple times in the configuration. All matching `import`s will be merged.
- All matching variables will be filled in, so ensure not to have multiple variables with the configured name (the transformer does not care of the scopes).
- Files to import must be under the project root. Files outside of the root directory will be ignored, even if they match the provided glob.

# Contributing

Even though we cannot guarantee a response time, please feel free to file an issue if you have any question or problem using the package.

_Pull Requests_ are welcome. You can, of course, submit corrections or improvements for code, but do not hesitate to also improve documentation, even for small spell or grammar errors.
