import { searchConversations, formatResults, SearchOptions, DataSource } from './search.js';

const query = process.argv[2];
const mode = (process.argv[3] || 'vector') as 'vector' | 'text' | 'both';
const limit = parseInt(process.argv[4] || '10');
const after = process.argv[5] || undefined;
const before = process.argv[6] || undefined;
const sourcesArg = process.argv[7];

if (!query) {
  console.error('Usage: search-conversations <query> [mode] [limit] [after] [before] [sources]');
  process.exit(1);
}

const sources: DataSource[] = sourcesArg
  ? typeof sourcesArg === 'string'
    ? sourcesArg.split(',').map((s: string) => s.trim() as DataSource)
    : sourcesArg.map((s: string) => s.trim() as DataSource)
  : ['all'];

const options: SearchOptions = {
  mode,
  limit,
  after,
  before,
  sources
};

searchConversations(query, options)
  .then(results => {
    console.log(formatResults(results));
  })
  .catch(error => {
    console.error('Error searching:', error);
    process.exit(1);
  });
