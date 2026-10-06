// Windows may allocate a WHATWG Fetch restricted port (notably 10080) for port 0.
// Retry binding, rather than randomly failing every request in a test suite.
const restricted = new Set([2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);
export async function listenForFetch(server) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    if (!restricted.has(server.address().port)) return;
    await new Promise(resolve => server.close(resolve));
  }
  throw new Error('Could not allocate a fetch-compatible test port');
}
