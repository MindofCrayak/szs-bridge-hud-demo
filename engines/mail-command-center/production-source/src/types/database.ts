export interface SystemSetting {
  Setting_Name: string;
  Value: string | number | boolean;
  Description: string;
}

export interface Newsletter {
  newsletter_id: string;
  name: string;
  sender_alias: string;
  reply_to: string;
  default_template_id: string;
  created_at: string;
}

export interface Subscriber {
  subscriber_id: string;
  email: string;
  first_name: string;
  last_name: string;
  subscribed_newsletters: string;
  status: 'active' | 'unsubscribed' | 'bounced' | string;
  source: string;
  external_id: string;
  created_at: string;
}

export interface Campaign {
  campaign_id: string;
  newsletter_id: string;
  name: string;
  content_type: string;
  source_id: string;
  status: 'DRAFT' | 'APPROVED' | 'TEST_SENT' | 'SENDING' | 'RESUMING' | 'COMPLETED' | 'PAUSED_QUOTA' | 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | string;
  scheduled_time: string;
  subject_line_a: string;
  subject_line_b: string;
  test_split_ratio: number;
}

export interface DripSequence {
  sequence_id: string;
  newsletter_id: string;
  name: string;
  step_number: number;
  delay_days: number;
  content_type: string;
  source_id: string;
}

export interface Template {
  template_id: string;
  name: string;
  type: string;
  drive_file_id: string;
  last_updated: string;
}

export interface DeliveryLog {
  log_id_key: string;
  subscriber_id: string;
  email: string;
  campaign_or_drip_id: string;
  step_number: string | number;
  variant_sent: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'opened' | 'failed' | 'bounced' | string;
  error_message: string;
}

export interface DatabaseState {
  System_Settings: SystemSetting[];
  Newsletters: Newsletter[];
  Subscribers: Subscriber[];
  Campaigns: Campaign[];
  Drip_Sequences: DripSequence[];
  Templates: Template[];
  Delivery_Logs: DeliveryLog[];
}
