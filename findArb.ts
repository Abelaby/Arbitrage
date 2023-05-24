import { BalancerSDK, BalancerSdkConfig, Network } from '@balancer-labs/sdk';

interface Opportunity {
  path: string[];
  profit: number;
}

async function findArbitrageOpportunities() {
  const config: BalancerSdkConfig = {
    network: Network.MAINNET,
    rpcUrl: ``,
  };
  const balancer = new BalancerSDK(config);
  const { pools } = balancer.data;

  while (true) {
    try {
      const allPools = await pools.all();

      // Build a graph of token connections
      const graph = buildTokenGraph(allPools);

      // Perform graph search to find arbitrage opportunities
      const opportunities: Opportunity[] = searchForArbitrage(graph, allPools);

      // Print the found opportunities
      opportunities.forEach(opportunity => {
        console.log('Arbitrage Opportunity Found!');
        console.log('Path:', opportunity.path.join(' -> '));
        console.log('Profit:', opportunity.profit);
        console.log('-----------------------------');
      });

    } catch (error) {
      console.error('An error occurred:', error);
    }
  }
}

function buildTokenGraph(pools: any[]): Record<string, Record<string, number>> {
  const graph: Record<string, Record<string, number>> = {};

  // Iterate over the pools
  for (const pool of pools) {
    const tokens = pool.tokens.map((token: any) => token.address);

    // Add token connections to the graph
    for (let i = 0; i < tokens.length; i++) {
      const tokenA = tokens[i];

      if (!(tokenA in graph)) {
        graph[tokenA] = {};
      }

      for (let j = i + 1; j < tokens.length; j++) {
        const tokenB = tokens[j];

        if (!(tokenB in graph)) {
          graph[tokenB] = {};
        }

        graph[tokenA][tokenB] = 1; // Set weight to 1 for simplicity
        graph[tokenB][tokenA] = 1;
      }
    }
  }

  return graph;
}

function searchForArbitrage(graph: Record<string, Record<string, number>>, pools: any[]): Opportunity[] {
  const opportunities: Opportunity[] = [];

  // Iterate over all tokens as potential starting points
  for (const token of Object.keys(graph)) {
    const visited = new Set<string>();
    const queue: string[] = [];
    const distances: Record<string, number> = {};
    const previous: Record<string, string | undefined> = {};

    // Initialize distances to Infinity except for the starting token (distance 0)
    for (const t of Object.keys(graph)) {
      distances[t] = Infinity;
    }
    distances[token] = 0;

    queue.push(token);

    while (queue.length > 0) {
      let currentToken: string = queue.shift() || '';

      if (visited.has(currentToken)) {
        continue;
      }
      visited.add(currentToken);

      const neighbors = graph[currentToken];

      for (const neighbor of Object.keys(neighbors)) {
        const weight = neighbors[neighbor];
        const distance = distances[currentToken] + weight;

        if (distance < distances[neighbor]) {
          distances[neighbor] = distance;
          previous[neighbor] = currentToken;
          queue.push(neighbor);
        }

        // Check for negative-weight cycles (arbitrage opportunities)
        if (distance < 0) {
          const path = getPath(previous, neighbor);
          const profit = calculateProfit(path, pools);
          opportunities.push({ path, profit });
        }
      }
    }
  }

  return opportunities;
}

function getPath(previous: Record<string, string | undefined>, token: string): string[] {
  const path: string[] = [token];
  let currentToken: string = token;

  while (previous[currentToken]) {
    currentToken = previous[currentToken]!;
    path.unshift(currentToken);
  }

  return path;
}

function calculateProfit(path: string[], pools: any[]): number {
  let profit = 1; // Initial profit set to 1 for each arbitrage opportunity

  for (let i = 0; i < path.length - 1; i++) {
    const tokenA = path[i];
    const tokenB = path[i + 1];

    const pool = findPoolByTokens(tokenA, tokenB, pools);

    if (!pool) {
      // Pool not found, handle the error or return a default value
      return 0;
    }

    const tokenAIndex = getTokenIndex(tokenA, pool.tokens);
    const tokenBIndex = getTokenIndex(tokenB, pool.tokens);

    if (tokenAIndex === -1 || tokenBIndex === -1) {
      // Tokens not found in the pool, handle the error or return a default value
      return 0;
    }

    const tokenAPrice = pool.tokens[tokenAIndex].balance / pool.tokens[tokenAIndex].weight;
    const tokenBPrice = pool.tokens[tokenBIndex].balance / pool.tokens[tokenBIndex].weight;

    profit *= tokenBPrice / tokenAPrice;
  }

  return profit;
}

function findPoolByTokens(tokenA: string, tokenB: string, pools: any[]): any | undefined {
  for (const pool of pools) {
    const tokens = pool.tokens.map((token: any) => token.address);
    if (tokens.includes(tokenA) && tokens.includes(tokenB)) {
      return pool;
    }
  }
  return undefined;
}

function getTokenIndex(token: string, tokens: any[]): number {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].address === token) {
      return i;
    }
  }
  return -1;
}

findArbitrageOpportunities();
