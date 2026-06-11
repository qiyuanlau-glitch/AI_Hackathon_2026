import { onRequest as __agent_proxy_js_onRequest } from "/Users/junyu/Dev/hackathon/functions/agent-proxy.js"

export const routes = [
    {
      routePath: "/agent-proxy",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__agent_proxy_js_onRequest],
    },
  ]