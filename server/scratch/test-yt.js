const ytSearch = require('yt-search');
ytSearch('shakira').then(r => {
  console.log('Results found:', r.videos.length);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
