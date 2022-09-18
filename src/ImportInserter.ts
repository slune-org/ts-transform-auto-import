import type { NodeVisitor } from 'simple-ts-transform'
import { isSourceFile, Node, SourceFile } from 'typescript'

import type TContext from './TContext'

/**
 * The visitor inserting imports at the begining of the file.
 */
export default class ImportInserter implements NodeVisitor<SourceFile> {
  public constructor(private readonly context: TContext) {}

  public wants(node: Node): node is SourceFile {
    return isSourceFile(node) && Object.keys(this.context.importedFiles).length > 0
  }

  public visit(node: SourceFile): Node[] {
    const {
      createImportClause,
      createImportDeclaration,
      createStringLiteral,
      getGeneratedNameForNode,
      updateImportClause,
      updateImportDeclaration,
      updateSourceFile,
    } = this.context.factory
    return [
      updateSourceFile(node, [
        ...Object.entries(this.context.importedFiles).map(([filepath, importIdentifier]) => {
          const declaration = createImportDeclaration(
            undefined,
            createImportClause(false, importIdentifier, undefined),
            createStringLiteral(filepath)
          )
          const newIdentifier = getGeneratedNameForNode(declaration)
          this.context.importedFiles[filepath] = newIdentifier
          return updateImportDeclaration(
            declaration,
            undefined,
            updateImportClause(declaration.importClause!, false, newIdentifier, undefined),
            createStringLiteral(filepath),
            undefined
          )
        }),
        ...node.statements,
      ]),
    ]
  }
}
