/* eslint-disable prefer-arrow-callback, no-unused-expressions */
import { expect } from 'chai'
import { join } from 'path'
import Compiler, { CompilationResult, defaultTsConfig } from 'ts-transform-test-compiler'
import { ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript'

import transformer from '.'

describe('ts-transform-auto-import', function () {
  this.slow(4000)
  this.timeout(10000)

  const testCases: {
    [name: string]: {
      root?: string
      config: any
      result: { constValues: any; varValues: any; letValues: any }
    }
  } = {
    'Simple test': {
      root: '__test__/src',
      config: {
        autoImports: [
          {
            source: { glob: 'plugins/*.ts', ignore: '**/index.ts' },
            target: { file: 'plugins/index.ts', variable: 'constValues' },
          },
          {
            source: { glob: 'plugins/specials/*.ts' },
            target: { file: 'plugins/index.ts', variable: 'letValues' },
          },
          {
            source: { glob: 'plugins/specials/*' },
            target: { file: 'plugins/index.ts', variable: 'varValues' },
          },
        ],
      },
      result: {
        constValues: {
          'myFirstPlugin.ts': 'Hello from myFirstPlugin.ts',
          'otherone.ts': 'Hello from otherone.ts',
          'parasite.ts': 'Hello from parasite.ts',
        },
        letValues: {
          'specials/specialThing.ts': 'This is a special thing',
          'specials/other.ts': 'This is another special module',
        },
        varValues: {
          'specials/specialThing.ts': 'This is a special thing',
          'specials/other.ts': 'This is another special module',
        },
      },
    },
    'Test which should not update anything': {
      root: '__test__/src',
      config: {
        autoImports: [
          {
            source: { glob: 'plugins/specials/*.ts' },
            target: { file: 'index.ts', variable: 'varValues' },
          },
        ],
      },
      result: {
        constValues: {},
        letValues: {},
        varValues: { initialized: true },
      },
    },
    'Test with merging results': {
      root: '__test__/src',
      config: {
        autoImports: [
          {
            source: { glob: 'plugins/*.ts', ignore: '**/index.ts' },
            target: { file: 'plugins/index.ts', variable: 'constValues' },
          },
          {
            source: { glob: 'plugins/specials/*.ts' },
            target: { file: 'plugins/index.ts', variable: 'constValues' },
          },
        ],
      },
      result: {
        constValues: {
          'myFirstPlugin.ts': 'Hello from myFirstPlugin.ts',
          'otherone.ts': 'Hello from otherone.ts',
          'parasite.ts': 'Hello from parasite.ts',
          'specials/specialThing.ts': 'This is a special thing',
          'specials/other.ts': 'This is another special module',
        },
        letValues: {},
        varValues: { initialized: true },
      },
    },
    'Test with extension rewrite option': {
      root: '__test__/src',
      config: {
        autoImports: [
          {
            source: { glob: 'plugins/*.@(ts|mts|js)', ignore: '**/index.ts' },
            target: {
              file: 'plugins/index.ts',
              variable: 'constValues',
              extensionRewrite: { ts: 'js', mts: 'mjs' },
            },
          },
        ],
      },
      result: {
        constValues: {
          'directjs.js': 'I am a direct JS module',
          'iammjs.mts': 'I am an MJS module',
          'myFirstPlugin.ts': 'Hello from myFirstPlugin.ts',
          'otherone.ts': 'Hello from otherone.ts',
          'parasite.ts': 'Hello from parasite.ts',
        },
        letValues: {},
        varValues: { initialized: true },
      },
    },
    'Test with files outside of index directory': {
      root: '__test__/src',
      config: {
        autoImports: [
          {
            source: { glob: 'outside/*.ts' },
            target: { file: 'plugins/index.ts', variable: 'letValues' },
          },
          {
            source: { glob: '**/*.ts', ignore: '**/index.ts' },
            target: { file: 'plugins/index.ts', variable: 'varValues' },
          },
        ],
      },
      result: {
        constValues: {},
        letValues: { '../outside/outsideFile.ts': 'I am outside of the folder' },
        varValues: {
          'myFirstPlugin.ts': 'Hello from myFirstPlugin.ts',
          'otherone.ts': 'Hello from otherone.ts',
          'parasite.ts': 'Hello from parasite.ts',
          'specials/specialThing.ts': 'This is a special thing',
          'specials/other.ts': 'This is another special module',
          '../outside/outsideFile.ts': 'I am outside of the folder',
        },
      },
    },
    'Test without root directory': {
      config: {
        autoImports: [
          {
            source: { glob: '__test__/src/plugins/*.ts', ignore: '**/index.ts' },
            target: { file: '__test__/src/plugins/index.ts', variable: 'constValues' },
          },
        ],
      },
      result: {
        constValues: {
          'myFirstPlugin.ts': 'Hello from myFirstPlugin.ts',
          'otherone.ts': 'Hello from otherone.ts',
          'parasite.ts': 'Hello from parasite.ts',
        },
        letValues: {},
        varValues: { initialized: true },
      },
    },
    'Test with files out of root': {
      root: '__test__/src',
      config: {
        autoImports: [
          {
            source: { glob: __filename },
            target: { file: 'plugins/index.ts', variable: 'varValues' },
          },
        ],
      },
      result: {
        constValues: {},
        letValues: {},
        varValues: {},
      },
    },
  }
  const compiler = new Compiler(transformer, '__test__/dist', {
    ...defaultTsConfig,
    target: ScriptTarget.ES2020,
    moduleResolution: ModuleResolutionKind.NodeNext,
    module: ModuleKind.NodeNext,
    esModuleInterop: true,
    allowJs: true,
  })

  describe('Configuration problems', function () {
    const regularConfig = { source: { glob: 'glob' }, target: { file: 'file', variable: 'variable' } }
    const badConfigurationCases: {
      [name: string]: { config: any; message: RegExp }
    } = {
      'null configuration type': { config: null, message: /configuration must be an object/ },
      'bad configuration type': { config: true, message: /configuration must be an object/ },
      'missing autoImports': { config: {}, message: /missing “autoImports” entry/ },
      'bad autoImports type': {
        config: { autoImports: regularConfig },
        message: /“autoImports” must be an array/,
      },
      'bad configuration item type': {
        config: { autoImports: [regularConfig, 'bad type'] },
        message: /(item #2).*configuration must be an object/,
      },
      'missing source': {
        config: { autoImports: [{ target: regularConfig.target }] },
        message: /(item #1).*missing “source” entry/,
      },
      'bad source type': {
        config: { autoImports: [regularConfig, { ...regularConfig, source: 'bad type' }] },
        message: /(item #2).*“source” entry must be an object/,
      },
      'missing source.glob': {
        config: { autoImports: [{ source: { ignore: '*' }, target: regularConfig.target }] },
        message: /(item #1).*missing “source.glob”/,
      },
      'bad source.glob type': {
        config: { autoImports: [{ source: { glob: true }, target: regularConfig.target }] },
        message: /(item #1).*“source.glob” must be a string/,
      },
      'bad source.ignore type': {
        config: {
          autoImports: [
            { source: { glob: regularConfig.source.glob, ignore: {} }, target: regularConfig.target },
          ],
        },
        message: /“source.ignore” must either be a string or a string array/,
      },
      'missing target': {
        config: { autoImports: [regularConfig, { source: regularConfig.source }] },
        message: /(item #2).*missing “target” entry/,
      },
      'bad target type': {
        config: { autoImports: [{ ...regularConfig, target: 'bad type' }] },
        message: /(item #1).*“target” entry must be an object/,
      },
      'missing target.file': {
        config: {
          autoImports: [
            { source: regularConfig.source, target: { variable: regularConfig.target.variable } },
          ],
        },
        message: /(item #1).*missing “target.file”/,
      },
      'bad target.file type': {
        config: {
          autoImports: [{ source: regularConfig.source, target: { ...regularConfig.target, file: true } }],
        },
        message: /(item #1).*“target.file” must be a string/,
      },
      'missing target.variable': {
        config: {
          autoImports: [{ source: regularConfig.source, target: { file: regularConfig.target.file } }],
        },
        message: /(item #1).*missing “target.variable”/,
      },
      'bad target.variable type': {
        config: {
          autoImports: [
            { source: regularConfig.source, target: { ...regularConfig.target, variable: true } },
          ],
        },
        message: /(item #1).*“target.variable” must be a string/,
      },
      'bad target.extensionRewrite type': {
        config: {
          autoImports: [
            {
              source: regularConfig.source,
              target: { ...regularConfig.target, extensionRewrite: true },
            },
          ],
        },
        message: /(item #1).*“target.extensionRewrite” must be an object/,
      },
    }
    Object.entries(badConfigurationCases).forEach(([name, { config, message }]) => {
      it(`should throw an error if ${name}`, function () {
        expect(() => compiler.setRootDir('__test__/src').compile('config', config)).to.throw(message)
      })
    })
  })

  Object.entries(testCases).forEach(([name, testCase]) => {
    describe(name, function () {
      let result: CompilationResult

      before(`Compile files to ${name}`, function () {
        result = compiler
          .setRootDir(testCase.root)
          .setSourceFiles((testCase.root ? '/' : '__test__/src/') + '**/*.@(ts|mts|js)')
          .compile(name, testCase.config)
        result.print()
      })

      const valueTypes: Array<'constValues' | 'letValues' | 'varValues'> = [
        'constValues',
        'letValues',
        'varValues',
      ]
      valueTypes.forEach(valueType => {
        it(`should give correct ${valueType}`, async function () {
          // Eval workaround is mandatory because current versions of Typescript is compiling imports to require
          // eslint-disable-next-line no-eval
          const mod = await eval("import('" + join((result as any).outDir, 'index.js') + "')")
          expect(mod[valueType]).to.deep.equal(testCase.result[valueType])
        })
      })
    })
  })
})
