import buildTransformer from 'simple-ts-transform'

import FileAnalyzer from './FileAnalyzer'
import ImportInserter from './ImportInserter'
import RequireInserter from './RequireInserter'
import TContext from './TContext'

const transformer = buildTransformer(TContext, [FileAnalyzer, ImportInserter, RequireInserter])
export default transformer
