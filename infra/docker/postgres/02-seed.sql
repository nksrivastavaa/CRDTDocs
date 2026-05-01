INSERT INTO users (id, email, password_hash, display_name, avatar_url)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com', crypt('password123', gen_salt('bf', 10)), 'Olivia Owner', NULL),
  ('00000000-0000-0000-0000-000000000002', 'editor@example.com', crypt('password123', gen_salt('bf', 10)), 'Evan Editor', NULL),
  ('00000000-0000-0000-0000-000000000003', 'viewer@example.com', crypt('password123', gen_salt('bf', 10)), 'Vera Viewer', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, owner_id, invite_code)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Acme Product Team',
  '00000000-0000-0000-0000-000000000001',
  'acme-product-team'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO documents (id, workspace_id, owner_id, title, content)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Launch Plan',
  '{
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": { "level": 1 },
        "content": [{ "type": "text", "text": "Launch Plan" }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Use this document for live collaborative planning, comments, and file attachments." }]
      }
    ]
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_permissions (document_id, user_id, role)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'editor'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'viewer')
ON CONFLICT (document_id, user_id) DO NOTHING;

INSERT INTO notifications (user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'document_shared',
  'Document shared with you',
  'Olivia shared Launch Plan with you as editor.',
  'document',
  '20000000-0000-0000-0000-000000000001',
  '{"role":"editor"}'::jsonb
)
ON CONFLICT DO NOTHING;
