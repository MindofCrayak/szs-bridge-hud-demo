import { DatabaseState } from '../types/database';

export const initialDatabase: DatabaseState = {
  System_Settings: [
    {
      Setting_Name: 'GLOBAL_KILL_SWITCH',
      Value: false,
      Description: 'Master kill switch. If true, halts all email processing and mutative tasks immediately.'
    },
    {
      Setting_Name: 'DAILY_QUOTA_LIMIT',
      Value: 100,
      Description: 'Safety reserve buffer for Gmail daily sending limit (e.g. 100 quota reserved).'
    },
    {
      Setting_Name: 'EXECUTION_TIME_LIMIT_MS',
      Value: 270000,
      Description: 'Apps Script 4.5-minute safe execution threshold before saving state to PropertiesService.'
    },
    {
      Setting_Name: 'DEFAULT_SENDER_NAME',
      Value: 'Engineering Weekly Digest',
      Description: 'Default sender display name when dispatching via GmailApp.'
    },
    {
      Setting_Name: 'TRACKING_PIXEL_ENABLED',
      Value: true,
      Description: 'Inject 1x1 transparent open tracking pixel into outgoing HTML email bodies.'
    },
    {
      Setting_Name: 'BATCH_SIZE',
      Value: 50,
      Description: 'Number of subscribers processed per trigger cycle.'
    }
  ],
  Newsletters: [
    {
      newsletter_id: 'news_tech_weekly',
      name: 'Tech & Architecture Weekly',
      sender_alias: 'newsletters@acme.com',
      reply_to: 'support@acme.com',
      default_template_id: 'tpl_minimal_dark',
      created_at: '2026-10-15T12:00:00.000Z'
    },
    {
      newsletter_id: 'news_product_updates',
      name: 'Monthly Product Release Notes',
      sender_alias: 'product@acme.com',
      reply_to: 'feedback@acme.com',
      default_template_id: 'tpl_changelog',
      created_at: '2026-10-18T09:30:00.000Z'
    }
  ],
  Subscribers: [
    {
      subscriber_id: 'sub_k92m1_8af',
      email: 'alex.rivera@sessionzero.solutions',
      first_name: 'Alex',
      last_name: 'Rivera',
      subscribed_newsletters: 'news_tech_weekly, news_product_updates',
      status: 'active',
      source: 'web_signup',
      external_id: 'usr_8921',
      created_at: '2026-10-16T14:22:00.000Z'
    },
    {
      subscriber_id: 'sub_p41q8_3bc',
      email: 'sarah.connor@cyberdyne.org',
      first_name: 'Sarah',
      last_name: 'Connor',
      subscribed_newsletters: 'news_tech_weekly',
      status: 'active',
      source: 'api_import',
      external_id: 'usr_9043',
      created_at: '2026-10-17T08:15:00.000Z'
    },
    {
      subscriber_id: 'sub_m77v2_9kd',
      email: 'dev.marcus@matrix.net',
      first_name: 'Marcus',
      last_name: 'Vance',
      subscribed_newsletters: 'news_product_updates',
      status: 'active',
      source: 'partner_referral',
      external_id: 'usr_7110',
      created_at: '2026-10-19T17:40:00.000Z'
    }
  ],
  Campaigns: [
    {
      campaign_id: 'camp_oct20_arch',
      newsletter_id: 'news_tech_weekly',
      name: 'System Architecture Deep Dive #42',
      content_type: 'html',
      source_id: 'doc_188291a',
      status: 'completed',
      scheduled_time: '2026-10-20T10:00:00.000Z',
      subject_line_a: 'Deep Dive: Scaling Google Sheets as a Relational DB',
      subject_line_b: 'How we built a self-hosted Mailchimp on Apps Script',
      test_split_ratio: 50
    },
    {
      campaign_id: 'camp_v2_launch',
      newsletter_id: 'news_product_updates',
      name: 'Release 2.4 - Automation & Webhooks',
      content_type: 'html',
      source_id: 'doc_299102b',
      status: 'draft',
      scheduled_time: '',
      subject_line_a: 'Announcing 2.4: Instant Webhooks & Drip Campaigns',
      subject_line_b: 'What is new in Acme 2.4',
      test_split_ratio: 50
    }
  ],
  Drip_Sequences: [
    {
      sequence_id: 'drip_onboarding_seq',
      newsletter_id: 'news_tech_weekly',
      name: 'Subscriber Welcome Sequence',
      step_number: 1,
      delay_days: 0,
      content_type: 'html',
      source_id: 'doc_welcome_day0'
    },
    {
      sequence_id: 'drip_onboarding_seq',
      newsletter_id: 'news_tech_weekly',
      name: 'Subscriber Welcome Sequence',
      step_number: 2,
      delay_days: 3,
      content_type: 'html',
      source_id: 'doc_welcome_day3'
    }
  ],
  Templates: [
    {
      template_id: 'tpl_minimal_dark',
      name: 'Developer Clean Dark & Light Hybrid',
      type: 'html',
      drive_file_id: 'drive_1k982nxa',
      last_updated: '2026-10-15T12:00:00.000Z'
    },
    {
      template_id: 'tpl_changelog',
      name: 'Changelog Release Bulletin',
      type: 'html',
      drive_file_id: 'drive_2m019pzb',
      last_updated: '2026-10-18T09:30:00.000Z'
    }
  ],
  Delivery_Logs: [
    {
      log_id_key: 'alex.rivera@sessionzero.solutions_camp_oct20_arch_0',
      subscriber_id: 'sub_k92m1_8af',
      email: 'alex.rivera@sessionzero.solutions',
      campaign_or_drip_id: 'camp_oct20_arch',
      step_number: 0,
      variant_sent: 'A',
      timestamp: '2026-10-20T10:05:12.000Z',
      status: 'opened',
      error_message: ''
    },
    {
      log_id_key: 'sarah.connor@cyberdyne.org_camp_oct20_arch_0',
      subscriber_id: 'sub_p41q8_3bc',
      email: 'sarah.connor@cyberdyne.org',
      campaign_or_drip_id: 'camp_oct20_arch',
      step_number: 0,
      variant_sent: 'B',
      timestamp: '2026-10-20T10:05:15.000Z',
      status: 'delivered',
      error_message: ''
    }
  ]
};
