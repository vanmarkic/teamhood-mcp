#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Load secrets from SOPS
function loadSecrets(): { apiKey: string; baseUrl: string } {
  const secretsPath = join(projectRoot, "secrets.yaml");

  if (!existsSync(secretsPath)) {
    return {
      apiKey: process.env.TEAMHOOD_API_KEY || "",
      baseUrl: process.env.TEAMHOOD_BASE_URL || "https://api-lafermedutemple.teamhood.com/api/v1",
    };
  }

  try {
    const decrypted = execSync(`sops -d "${secretsPath}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const lines = decrypted.split("\n");
    const secrets: Record<string, string> = {};

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        secrets[match[1]] = match[2].trim();
      }
    }

    return {
      apiKey: secrets.TEAMHOOD_API_KEY || process.env.TEAMHOOD_API_KEY || "",
      baseUrl: secrets.TEAMHOOD_BASE_URL || process.env.TEAMHOOD_BASE_URL || "https://api-lafermedutemple.teamhood.com/api/v1",
    };
  } catch {
    return {
      apiKey: process.env.TEAMHOOD_API_KEY || "",
      baseUrl: process.env.TEAMHOOD_BASE_URL || "https://api-lafermedutemple.teamhood.com/api/v1",
    };
  }
}

const secrets = loadSecrets();
const API_KEY = secrets.apiKey;
const BASE_URL = secrets.baseUrl;

// API Client
async function apiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Authorization": API_KEY,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

// ============================================================================
// TOOL DEFINITIONS - Complete Teamhood API Coverage
// ============================================================================
const tools: Tool[] = [
  // === WORKSPACES ===
  {
    name: "list_workspaces",
    description: "List all workspaces you have access to",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_workspace",
    description: "Get workspace details including settings and metadata",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID" },
      },
      required: ["workspaceId"],
    },
  },
  {
    name: "create_workspace",
    description: "Create a new workspace. Requires templateId from list_workspace_templates and ownerId from list_users.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Workspace title" },
        displayId: { type: "string", description: "Short display ID (e.g., 'PROJ')" },
        icon: { type: "string", description: "Icon type (e.g., 'briefcase', 'star')" },
        color: { type: "number", description: "Color code (optional)" },
        templateId: { type: "string", description: "Workspace template UUID (use list_workspace_templates)" },
        ownerId: { type: "string", description: "Owner user UUID (use list_users)" },
      },
      required: ["title", "displayId", "icon", "templateId", "ownerId"],
    },
  },
  {
    name: "add_workspace_member",
    description: "Add a user to a workspace with Collaborator role (API does not support custom roles)",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID" },
        userId: { type: "string", description: "User UUID to add" },
      },
      required: ["workspaceId", "userId"],
    },
  },
  {
    name: "list_boards",
    description: "List all boards in a workspace",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID" },
      },
      required: ["workspaceId"],
    },
  },

  // === BOARDS ===
  {
    name: "get_board",
    description: "Get a specific board by ID (returns board info from workspace boards list)",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID containing the board" },
        boardId: { type: "string", description: "Board UUID to retrieve" },
      },
      required: ["workspaceId", "boardId"],
    },
  },
  {
    name: "create_board",
    description: "Create a new board in a workspace. Requires templateId from list_board_templates.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID where board will be created" },
        title: { type: "string", description: "Board title" },
        displayId: { type: "string", description: "Short display ID (e.g., 'Q1PRIO') - required" },
        templateId: { type: "string", description: "Board template UUID (use list_board_templates to get available templates)" },
        viewType: {
          type: "string",
          enum: ["Kanban", "Gantt", "List", "Overview"],
          description: "Default view type for the board"
        },
      },
      required: ["workspaceId", "title", "displayId", "templateId", "viewType"],
    },
  },
  {
    name: "list_rows",
    description: "List rows (swimlanes) on a board for grouping items",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "Board UUID" },
      },
      required: ["boardId"],
    },
  },
  {
    name: "list_statuses",
    description: "List status columns on a board (workflow stages)",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "Board UUID" },
      },
      required: ["boardId"],
    },
  },
  {
    name: "create_row",
    description: "Create a new row (swimlane) on a board",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "Board UUID" },
        title: { type: "string", description: "Row title" },
        startDate: { type: "string", description: "Optional start date (ISO 8601)" },
        endDate: { type: "string", description: "Optional end date (ISO 8601)" },
      },
      required: ["boardId", "title"],
    },
  },

  // === ITEMS ===
  {
    name: "list_items",
    description: "Search and filter items across boards with pagination",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Filter by workspace UUID" },
        boardId: { type: "string", description: "Filter by board UUID" },
        statusId: { type: "string", description: "Filter by status UUID" },
        rowId: { type: "string", description: "Filter by row UUID" },
        assignedUserId: { type: "string", description: "Filter by assigned user UUID" },
        ownerId: { type: "string", description: "Filter by owner user UUID" },
        parentId: { type: "string", description: "Filter by parent item UUID" },
        completed: { type: "boolean", description: "Filter by completion status" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
        customFields: { type: "array", items: { type: "string" }, description: "Filter by custom fields, e.g. ['\"Project\"=\"Cars\"']" },
        createdSince: { type: "string", description: "Filter items created since (ISO 8601)" },
        modifiedSince: { type: "string", description: "Filter items modified since (ISO 8601)" },
        completedSince: { type: "string", description: "Filter items completed since (ISO 8601)" },
        includeChildItems: { type: "boolean", description: "Include child items in results" },
        skip: { type: "number", description: "Pagination: records to skip" },
        take: { type: "number", description: "Pagination: records to return (max 100)" },
      },
    },
  },
  {
    name: "get_item",
    description: "Get full item details including custom fields and metadata",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "create_item",
    description: "Create a new item (task/card) on a board",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID (required)" },
        boardId: { type: "string", description: "Board UUID where item will be created" },
        statusId: { type: "string", description: "Status UUID for initial workflow stage (required)" },
        title: { type: "string", description: "Item title" },
        description: { type: "string", description: "Rich text description" },
        rowId: { type: "string", description: "Row UUID for swimlane placement" },
        assigneeId: { type: "string", description: "User UUID to assign (single assignee)" },
        startDate: { type: "string", description: "Start date (ISO 8601 format)" },
        dueDate: { type: "string", description: "Due date (ISO 8601 format)" },
        color: { type: "number", description: "Color index (1-18)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags to apply to the item" },
        customFields: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Custom field values as name/value pairs",
        },
        blocking: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              direction: { type: "string", enum: ["FinishToStart", "StartToStart", "FinishToFinish", "StartToFinish"] },
            },
            required: ["itemId", "direction"],
          },
          description: "Items this task blocks (dependencies)",
        },
        waiting: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              direction: { type: "string", enum: ["FinishToStart", "StartToStart", "FinishToFinish", "StartToFinish"] },
            },
            required: ["itemId", "direction"],
          },
          description: "Items this task waits for (dependencies)",
        },
      },
      required: ["workspaceId", "boardId", "statusId", "title"],
    },
  },
  {
    name: "update_item",
    description: "Update item properties (title, status, board, assignee, dates, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID to update" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        statusId: { type: "string", description: "New status UUID (move to different column)" },
        rowId: { type: "string", description: "New row UUID (move to different swimlane)" },
        boardId: { type: "string", description: "New board UUID (move to different board)" },
        assigneeId: { type: "string", description: "User UUID to assign (single assignee)" },
        startDate: { type: "string", description: "New start date (ISO 8601)" },
        dueDate: { type: "string", description: "New due date (ISO 8601)" },
        color: { type: "number", description: "Color index (1-18)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for the item" },
        customFields: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Custom field values to update",
        },
        blocking: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              direction: { type: "string", enum: ["FinishToStart", "StartToStart", "FinishToFinish", "StartToFinish"] },
            },
            required: ["itemId", "direction"],
          },
          description: "Items this task blocks (replaces existing)",
        },
        waiting: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              direction: { type: "string", enum: ["FinishToStart", "StartToStart", "FinishToFinish", "StartToFinish"] },
            },
            required: ["itemId", "direction"],
          },
          description: "Items this task waits for (replaces existing)",
        },
        archived: { type: "boolean", description: "Archive or unarchive the item" },
        milestone: { type: "boolean", description: "Mark as milestone" },
        progress: { type: "number", description: "Progress percentage (0-100)" },
        parentId: { type: "string", description: "Parent item UUID for sub-items" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "delete_item",
    description: "Permanently delete an item",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID to delete" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "move_item",
    description: "Move an item to a different board, status column, or row (swimlane)",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID to move" },
        targetBoardId: { type: "string", description: "Target board UUID (to move between boards)" },
        targetStatusId: { type: "string", description: "Target status UUID (new column)" },
        targetRowId: { type: "string", description: "Target row UUID (new swimlane)" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "archive_item",
    description: "Archive or unarchive an item (soft delete - item can be restored)",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID to archive/unarchive" },
        archived: { type: "boolean", description: "True to archive, false to unarchive (default: true)" },
      },
      required: ["itemId"],
    },
  },

  // === ATTACHMENTS ===
  {
    name: "list_attachments",
    description: "List all attachments on an item",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "get_attachment",
    description: "Get attachment metadata (name, size, type)",
    inputSchema: {
      type: "object",
      properties: {
        attachmentId: { type: "string", description: "Attachment UUID" },
      },
      required: ["attachmentId"],
    },
  },
  {
    name: "download_attachment",
    description: "Download attachment file content by ID",
    inputSchema: {
      type: "object",
      properties: {
        attachmentId: { type: "string", description: "Attachment UUID" },
      },
      required: ["attachmentId"],
    },
  },
  {
    name: "update_attachment",
    description: "Update attachment name",
    inputSchema: {
      type: "object",
      properties: {
        attachmentId: { type: "string", description: "Attachment UUID" },
        name: { type: "string", description: "New filename" },
      },
      required: ["attachmentId", "name"],
    },
  },
  {
    name: "delete_attachment",
    description: "Permanently delete an attachment",
    inputSchema: {
      type: "object",
      properties: {
        attachmentId: { type: "string", description: "Attachment UUID to delete" },
      },
      required: ["attachmentId"],
    },
  },
  {
    name: "upload_attachment",
    description: "Upload a file attachment to an item. Note: For binary files, content should be base64 encoded.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Item UUID to attach file to" },
        name: { type: "string", description: "Filename with extension (e.g., 'report.pdf')" },
        content: { type: "string", description: "File content (base64 encoded for binary files)" },
      },
      required: ["itemId", "name", "content"],
    },
  },

  // === USERS ===
  {
    name: "list_users",
    description: "List all users in the organization",
    inputSchema: { type: "object", properties: {} },
  },

  // === TIME TRACKING ===
  // Note: API does not support creating timelogs, only reading them
  {
    name: "get_time_logs",
    description: "Get time logs for a workspace within a date range. Can filter by boards, rows, users, or tags.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", description: "Workspace UUID (required)" },
        startDate: { type: "string", description: "Start date (ISO 8601 UTC)" },
        endDate: { type: "string", description: "End date (ISO 8601 UTC)" },
        boardIds: { type: "array", items: { type: "string" }, description: "Filter by board UUIDs" },
        rowIds: { type: "array", items: { type: "string" }, description: "Filter by row UUIDs" },
        userIds: { type: "array", items: { type: "string" }, description: "Filter by user UUIDs" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
      },
      required: ["workspaceId", "startDate", "endDate"],
    },
  },

  // === TEMPLATES ===
  {
    name: "list_workspace_templates",
    description: "List available workspace templates",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_board_templates",
    description: "List available board templates. Use templateId when creating a new board.",
    inputSchema: { type: "object", properties: {} },
  },

  // === ACTIVITY / LOGS ===
  {
    name: "list_activities",
    description: "Get item change history on a board (audit log)",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "Board UUID" },
        startDate: { type: "string", description: "Start date (ISO 8601 UTC)" },
        endDate: { type: "string", description: "End date (ISO 8601 UTC, max 3 months from start)" },
        offset: { type: "number", description: "Pagination offset (default: 0)" },
        limit: { type: "number", description: "Records to return (default: 100, max: 1000)" },
      },
      required: ["boardId", "startDate", "endDate"],
    },
  },
  {
    name: "list_system_logs",
    description: "List system logs by date range with paging",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Start date (ISO 8601 UTC, e.g., 2024-02-05T02:00:00Z)" },
        toDate: { type: "string", description: "End date (ISO 8601 UTC)" },
        skip: { type: "number", description: "Number of records to skip" },
        take: { type: "number", description: "Number of records to take (max 1000)" },
      },
      required: ["fromDate", "toDate"],
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // === WORKSPACES ===
    case "list_workspaces":
      return apiRequest("/workspaces");

    case "get_workspace":
      return apiRequest(`/workspaces/${args.workspaceId}`);

    case "create_workspace":
      return apiRequest("/workspaces", "POST", {
        title: args.title,
        displayId: args.displayId,
        icon: args.icon,
        color: args.color,
        templateId: args.templateId,
        ownerId: args.ownerId,
      });

    case "add_workspace_member":
      return apiRequest(
        `/workspaces/${args.workspaceId}/users/${args.userId}`,
        "PUT",
        {} // API only accepts requestId (optional), role is fixed to Collaborator
      );

    case "list_boards":
      return apiRequest(`/workspaces/${args.workspaceId}/boards`);

    // === BOARDS ===
    case "get_board": {
      const boards = await apiRequest<Array<{ id: string }>>(`/workspaces/${args.workspaceId}/boards`);
      const board = boards.find((b) => b.id === args.boardId);
      if (!board) throw new Error(`Board ${args.boardId} not found in workspace`);
      return board;
    }

    case "create_board":
      return apiRequest("/boards", "POST", {
        workspaceId: args.workspaceId,
        title: args.title,
        displayId: args.displayId,
        templateId: args.templateId,
        viewType: args.viewType,
      });

    case "list_rows":
      return apiRequest(`/boards/${args.boardId}/rows`);

    case "list_statuses":
      return apiRequest(`/boards/${args.boardId}/statuses`);

    case "create_row":
      return apiRequest("/rows", "POST", {
        boardId: args.boardId,
        title: args.title,
        startDate: args.startDate,
        endDate: args.endDate,
      });

    // === ITEMS ===
    case "list_items": {
      const params = new URLSearchParams();
      if (args.workspaceId) params.append("WorkspaceId", args.workspaceId as string);
      if (args.boardId) params.append("BoardId", args.boardId as string);
      if (args.statusId) params.append("StatusId", args.statusId as string);
      if (args.rowId) params.append("RowId", args.rowId as string);
      if (args.assignedUserId) params.append("AssignedUserId", args.assignedUserId as string);
      if (args.ownerId) params.append("OwnerId", args.ownerId as string);
      if (args.parentId) params.append("ParentId", args.parentId as string);
      if (args.completed !== undefined) params.append("Completed", String(args.completed));
      if (args.tags) {
        for (const tag of args.tags as string[]) {
          params.append("Tags", tag);
        }
      }
      if (args.customFields) {
        for (const cf of args.customFields as string[]) {
          params.append("CustomFields", cf);
        }
      }
      if (args.createdSince) params.append("CreatedSince", args.createdSince as string);
      if (args.modifiedSince) params.append("ModifiedSince", args.modifiedSince as string);
      if (args.completedSince) params.append("CompletedSince", args.completedSince as string);
      if (args.includeChildItems !== undefined) params.append("IncludeChildItems", String(args.includeChildItems));
      if (args.skip !== undefined) params.append("Skip", String(args.skip));
      if (args.take !== undefined) params.append("Take", String(args.take));
      const query = params.toString();
      return apiRequest(`/items${query ? `?${query}` : ""}`);
    }

    case "get_item":
      return apiRequest(`/items/${args.itemId}`);

    case "create_item":
      return apiRequest("/items", "POST", {
        workspaceId: args.workspaceId,
        boardId: args.boardId,
        statusId: args.statusId,
        title: args.title,
        description: args.description,
        rowId: args.rowId,
        assignedUserId: args.assigneeId, // API uses singular assignedUserId
        startDate: args.startDate,
        dueDate: args.dueDate,
        color: args.color,
        tags: args.tags || [],
        customFields: args.customFields || [],
        blocking: args.blocking || [],
        waiting: args.waiting || [],
        milestone: false,
        isSuspended: false,
        suspendReason: "",
      });

    case "update_item": {
      const updateData: Record<string, unknown> = {};
      if (args.title !== undefined) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.statusId !== undefined) updateData.statusId = args.statusId;
      if (args.rowId !== undefined) updateData.rowId = args.rowId;
      if (args.boardId !== undefined) updateData.boardId = args.boardId;
      if (args.assigneeId !== undefined) updateData.userId = args.assigneeId; // API uses userId for update
      if (args.startDate !== undefined) updateData.startDate = args.startDate;
      if (args.dueDate !== undefined) updateData.dueDate = args.dueDate;
      if (args.color !== undefined) updateData.color = args.color;
      if (args.tags !== undefined) updateData.tags = args.tags;
      if (args.customFields !== undefined) updateData.customFields = args.customFields;
      if (args.blocking !== undefined) updateData.blocking = args.blocking;
      if (args.waiting !== undefined) updateData.waiting = args.waiting;
      if (args.archived !== undefined) updateData.archived = args.archived;
      if (args.milestone !== undefined) updateData.milestone = args.milestone;
      if (args.progress !== undefined) updateData.progress = args.progress;
      if (args.parentId !== undefined) updateData.parentId = args.parentId;
      // API expects { data: { ...fields } } structure
      return apiRequest(`/items/${args.itemId}`, "PUT", { data: updateData });
    }

    case "delete_item":
      return apiRequest(`/items/${args.itemId}`, "DELETE");

    case "move_item":
      return apiRequest(`/items/${args.itemId}`, "PUT", {
        data: {
          boardId: args.targetBoardId,
          statusId: args.targetStatusId,
          rowId: args.targetRowId,
        },
      });

    case "archive_item":
      return apiRequest(`/items/${args.itemId}`, "PUT", {
        data: { archived: args.archived ?? true },
      });

    // === ATTACHMENTS ===
    case "list_attachments":
      return apiRequest(`/items/${args.itemId}/attachments`);

    case "get_attachment":
      return apiRequest(`/attachments/${args.attachmentId}`);

    case "download_attachment":
      // Returns file content - note: binary handling may need special treatment
      return apiRequest(`/attachments/${args.attachmentId}/content`);

    case "update_attachment":
      return apiRequest(`/attachments/${args.attachmentId}`, "PUT", {
        Name: args.name,
      });

    case "delete_attachment":
      return apiRequest(`/attachments/${args.attachmentId}`, "DELETE");

    case "upload_attachment": {
      // For file uploads, we need multipart/form-data
      const url = `${BASE_URL}/attachments`;
      const formData = new FormData();
      formData.append("ItemId", args.itemId as string);
      formData.append("Name", args.name as string);
      // Content is expected as base64, decode for binary upload
      const content = args.content as string;
      const binaryContent = Buffer.from(content, "base64");
      const blob = new Blob([binaryContent]);
      formData.append("Content", blob, args.name as string);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : {};
    }

    // === USERS ===
    case "list_users":
      return apiRequest("/users");

    // === TIME TRACKING ===
    case "get_time_logs":
      return apiRequest("/timelogs", "POST", {
        workspaceId: args.workspaceId,
        startDate: args.startDate,
        endDate: args.endDate,
        boardIds: args.boardIds,
        rowIds: args.rowIds,
        userIds: args.userIds,
        tags: args.tags,
      });

    // === TEMPLATES ===
    case "list_workspace_templates":
      return apiRequest("/templates/workspace");

    case "list_board_templates":
      return apiRequest("/templates/board");

    // === ACTIVITY / LOGS ===
    case "list_activities":
      return apiRequest(`/boards/${args.boardId}/item-activities`, "POST", {
        startDate: args.startDate,
        endDate: args.endDate,
        offset: args.offset ?? 0,
        limit: args.limit ?? 100,
      });

    case "list_system_logs": {
      const logParams = new URLSearchParams();
      logParams.append("fromDate", args.fromDate as string);
      logParams.append("toDate", args.toDate as string);
      if (args.skip !== undefined) logParams.append("skip", String(args.skip));
      if (args.take !== undefined) logParams.append("take", String(args.take));
      return apiRequest(`/logs?${logParams.toString()}`);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// SERVER SETUP
// ============================================================================
const server = new Server(
  {
    name: "teamhood-mcp",
    version: "1.0.0",
    description: "MCP server for Teamhood project management API - enables AI assistants to manage workspaces, boards, items, and more",
    websiteUrl: "https://github.com/vanmarkic/teamhood-mcp",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args as Record<string, unknown>);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
