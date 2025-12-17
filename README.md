# Teamhood MCP Server

A Model Context Protocol (MCP) server for [Teamhood](https://teamhood.com) project management. Enables AI assistants like Claude to interact with Teamhood workspaces, boards, items, and more.

## Features

### Workspaces
- `list_workspaces` - List all accessible workspaces
- `get_workspace` - Get workspace details
- `create_workspace` - Create new workspace (requires template)
- `update_workspace_member` - Add/update user roles

### Boards
- `list_boards` - List boards in a workspace
- `get_board` - Get specific board details
- `create_board` - Create new board (requires template)
- `list_rows` - List swimlanes on a board
- `list_statuses` - List status columns on a board
- `create_row` - Create new swimlane

### Items (Tasks/Cards)
- `list_items` - Search/filter items with pagination
- `get_item` - Get full item details
- `create_item` - Create new item with dependencies, tags, custom fields
- `update_item` - Update item properties
- `delete_item` - Permanently delete item
- `move_item` - Move item between boards/columns/rows
- `archive_item` - Archive/unarchive item (soft delete)

### Attachments
- `list_attachments` - List attachments on an item
- `get_attachment` - Get attachment metadata
- `download_attachment` - Download attachment content
- `upload_attachment` - Upload file to an item
- `update_attachment` - Rename attachment
- `delete_attachment` - Delete attachment

### Time Tracking
- `log_time` - Log time spent on an item
- `get_time_logs` - Query time logs with filters

### Templates
- `list_workspace_templates` - Available workspace templates
- `list_board_templates` - Available board templates

### Activity & Logs
- `list_activities` - Item change history (audit log)
- `list_system_logs` - System logs by date range

### Users
- `list_users` - List all organization users

## Installation

```bash
npm install
npm run build
```

## Configuration

### Option 1: Environment Variables

```bash
export TEAMHOOD_API_KEY="your-api-key"
export TEAMHOOD_BASE_URL="https://api-YOURTENANT.teamhood.com/api/v1"
```

### Option 2: SOPS Encrypted Secrets

Create `secrets.yaml`:
```yaml
TEAMHOOD_API_KEY: your-api-key
TEAMHOOD_BASE_URL: https://api-YOURTENANT.teamhood.com/api/v1
```

Encrypt with SOPS:
```bash
sops -e secrets.yaml > secrets.enc.yaml
```

## Claude Desktop Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "teamhood": {
      "command": "node",
      "args": ["/path/to/teamhood-mcp/dist/index.js"],
      "env": {
        "TEAMHOOD_API_KEY": "your-api-key",
        "TEAMHOOD_BASE_URL": "https://api-YOURTENANT.teamhood.com/api/v1"
      }
    }
  }
}
```

## API Rate Limits

Teamhood API is limited to 100 requests per minute.

## License

MIT
