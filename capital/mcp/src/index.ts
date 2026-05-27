import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const API_URL = process.env.ADMIN_CENTER_API_URL || "http://localhost:5000";
const API_USERNAME = "admin";
const API_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

const api = axios.create({
  baseURL: API_URL,
  auth: {
    username: API_USERNAME,
    password: API_PASSWORD,
  },
});

const server = new Server(
  {
    name: "admin-center-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_containers",
        description: "List all registered apps/containers in the registry",
        inputSchema: {
          type: "object",
          properties: {
            filters: {
              type: "object",
              description: "Optional filters (status, type, search)",
            },
          },
        },
      },
      {
        name: "container_status",
        description: "Get detailed status of a specific container",
        inputSchema: {
          type: "object",
          properties: {
            container_name: { type: "string" },
            app_slug: { type: "string" },
          },
          required: ["container_name", "app_slug"],
        },
      },
      {
        name: "tail_logs",
        description: "Stream or fetch recent logs from a container",
        inputSchema: {
          type: "object",
          properties: {
            container_name: { type: "string" },
            app_slug: { type: "string" },
            lines: { type: "number", default: 100 },
            follow: { type: "boolean", default: false },
          },
          required: ["container_name", "app_slug"],
        },
      },
      {
        name: "restart_container",
        description: "Restart a Docker container",
        inputSchema: {
          type: "object",
          properties: {
            container_name: { type: "string" },
            app_slug: { type: "string" },
          },
          required: ["container_name", "app_slug"],
        },
      },
      {
        name: "read_config",
        description: "Read configuration for an app (docker-compose.yml, .env, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            app_slug: { type: "string" },
            config_type: {
              type: "string",
              enum: ["compose", "env", "all"],
              default: "all",
            },
          },
          required: ["app_slug"],
        },
      },
      {
        name: "health_check",
        description: "Manually trigger health check for an app",
        inputSchema: {
          type: "object",
          properties: {
            app_slug: { type: "string" },
            container_name: { type: "string" },
          },
          required: ["app_slug"],
        },
      },
      {
        name: "read_registry",
        description: "Read app registry entry",
        inputSchema: {
          type: "object",
          properties: {
            app_slug: { type: "string" },
            app_id: { type: "number" },
          },
        },
      },
      {
        name: "write_registry",
        description: "Create new app entry in registry",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            container_name: { type: "string" },
            project_type: { type: "string" },
            health_endpoint: { type: "string" },
            main_port: { type: "number" },
          },
          required: ["name", "slug"],
        },
      },
      {
        name: "update_registry",
        description: "Update existing app entry",
        inputSchema: {
          type: "object",
          properties: {
            app_slug: { type: "string" },
            updates: { type: "object" },
          },
          required: ["app_slug", "updates"],
        },
      },
      {
        name: "read_usage",
        description: "Read usage statistics for an app",
        inputSchema: {
          type: "object",
          properties: {
            app_slug: { type: "string" },
            days: { type: "number", default: 30 },
          },
          required: ["app_slug"],
        },
      },
      {
        name: "write_usage",
        description: "Track usage event",
        inputSchema: {
          type: "object",
          properties: {
            app_slug: { type: "string" },
            user: { type: "string" },
            action: { type: "string" },
            source: { type: "string" },
            duration_ms: { type: "number" },
            metadata: { type: "object" },
          },
          required: ["app_slug", "source"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_containers": {
        const filters = args?.filters || {};
        const response = await api.get("/api/apps", { params: filters });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "container_status": {
        const slug = args?.app_slug;
        if (!slug) {
          throw new Error("app_slug is required");
        }
        const response = await api.get(`/api/apps/${slug}/status`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "tail_logs": {
        const slug = args?.app_slug;
        if (!slug) {
          throw new Error("app_slug is required");
        }
        const lines = args?.lines || 100;
        const response = await api.get(`/api/apps/${slug}/logs`, {
          params: { lines },
        });
        return {
          content: [
            {
              type: "text",
              text: response.data.logs.join("\n"),
            },
          ],
        };
      }

      case "restart_container": {
        const slug = args?.app_slug;
        if (!slug) {
          throw new Error("app_slug is required");
        }
        const response = await api.post(`/api/apps/${slug}/restart`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "read_config": {
        const slug = args?.app_slug;
        if (!slug) {
          throw new Error("app_slug is required");
        }
        const configType = args?.config_type || "all";
        const response = await api.get(`/api/apps/${slug}/config`, {
          params: { type: configType },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "health_check": {
        const slug = args?.app_slug;
        if (!slug) {
          throw new Error("app_slug is required");
        }
        const response = await api.post(`/api/health/check/${slug}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "read_registry": {
        const slug = args?.app_slug;
        const id = args?.app_id;
        if (!slug && !id) {
          throw new Error("app_slug or app_id is required");
        }
        const response = await api.get(`/api/apps/${slug || id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "write_registry": {
        const response = await api.post("/api/apps", args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "update_registry": {
        const { app_slug, updates } = args as any;
        if (!app_slug) {
          throw new Error("app_slug is required");
        }
        const response = await api.patch(`/api/apps/${app_slug}`, updates);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "read_usage": {
        const slug = args?.app_slug;
        if (!slug) {
          throw new Error("app_slug is required");
        }
        const days = args?.days || 30;
        const response = await api.get(`/api/usage/${slug}`, {
          params: { days },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "write_usage": {
        const response = await api.post("/api/track", args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Admin Center MCP Server running on stdio");
}

main().catch(console.error);

