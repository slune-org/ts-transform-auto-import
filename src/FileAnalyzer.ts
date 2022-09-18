import { dirname, extname, relative, resolve, sep as pathSep } from 'path'
import type { NodeVisitor } from 'simple-ts-transform'
import type { Node, SourceFile } from 'typescript'
import { isSourceFile } from 'typescript'

import type TContext from './TContext'

/**
 * Format the path to posix.
 *
 * @param path - The path to format.
 * @returns The formatted path.
 */
function formatPath(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * Analyze a source file, check if it should be modified.
 */
export default class FileAnalyzer implements NodeVisitor<SourceFile> {
  public constructor(private readonly context: TContext) {}

  public wants(node: Node): node is SourceFile {
    return (
      isSourceFile(node) &&
      this.context.autoImports.some(
        autoImport =>
          formatPath(relative(this.context.basePath, node.fileName)) === formatPath(autoImport.file)
      )
    )
  }

  public visit(node: SourceFile): Node[] {
    this.context.autoImports
      // Remove configurations not for this file
      .filter(
        autoImport =>
          formatPath(relative(this.context.basePath, node.fileName)) === formatPath(autoImport.file)
      )
      .forEach(configuration => {
        if (!(configuration.variable in this.context.updatedVariables)) {
          this.context.updatedVariables[configuration.variable] = {}
        }
        const currentDir = dirname(node.fileName)
        configuration.foundFiles
          // Re-create the full path…
          .map(filename => resolve(this.context.basePath, filename))
          // …and get a path relative to current file.
          .map(filename => relative(currentDir, filename))
          // Manage extension, if any
          .map<[string, string]>(filename => {
            const extension = extname(filename).slice(1)
            let importedFilename = filename
            if (Object.keys(configuration.extensionRewrite).includes(extension)) {
              importedFilename =
                filename.slice(0, -extension.length) + configuration.extensionRewrite[extension]
            }
            return [importedFilename, filename]
          })
          .forEach(([importedFilename, filename]) => {
            const filepath = importedFilename.startsWith('.')
              ? importedFilename
              : '.' + pathSep + importedFilename
            if (!(filepath in this.context.importedFiles)) {
              this.context.importedFiles[filepath] = this.context.factory.createIdentifier(
                `auto_import_${Object.keys(this.context.importedFiles).length}`
              )
            }
            this.context.updatedVariables[configuration.variable][filename] = filepath
          })
      })
    return [node]
  }
}
