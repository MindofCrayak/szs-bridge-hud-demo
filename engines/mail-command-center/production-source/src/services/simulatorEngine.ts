import { DatabaseState, Subscriber, DeliveryLog, Campaign, Newsletter } from '../types/database';

export interface ApiResponse<T = any> {
  success: boolean;
  timestamp: string;
  data: T | null;
  error: string | null;
  code: string;
}

export interface CompiledEmailPreview {
  subject: string;
  variant: 'A' | 'B';
  html: string;
  unsubUrl: string;
  viewBrowserUrl: string;
  headers: Record<string, string>;
  recipientEmail: string;
}

export class AppsScriptSimulator {
  private db: DatabaseState;
  private isLocked: boolean = false;
  private mockQuota: number = 1450; // out of 1500 (Google Workspace standard quota)
  private simulatedProperties: Record<string, string> = {};
  private simulatedTriggers: Array<{ id: string; functionName: string; time: number }> = [];

  constructor(initialData: DatabaseState) {
    // Deep clone initial database state
    this.db = JSON.parse(JSON.stringify(initialData));
  }

  public getDatabaseState(): DatabaseState {
    return this.db;
  }

  public resetDatabase(initialData: DatabaseState): void {
    this.db = JSON.parse(JSON.stringify(initialData));
    this.simulatedProperties = {};
    this.simulatedTriggers = [];
  }

  public getSimulatedProperties(): Record<string, string> {
    return this.simulatedProperties;
  }

  public getSimulatedTriggers(): Array<{ id: string; functionName: string; time: number }> {
    return this.simulatedTriggers;
  }

  // ---------------------------------------------------------------------
  // Config.js Simulation
  // ---------------------------------------------------------------------
  public getSystemSettings(): Record<string, string | number | boolean> {
    const settings: Record<string, string | number | boolean> = {};
    for (const row of this.db.System_Settings) {
      settings[row.Setting_Name] = row.Value;
    }
    return settings;
  }

  public isGlobalKillSwitchActive(): boolean {
    const settings = this.getSystemSettings();
    const killVal = settings['GLOBAL_KILL_SWITCH'];
    if (killVal === true || killVal === 1 || killVal === '1') return true;
    if (typeof killVal === 'string' && killVal.trim().toLowerCase() === 'true') return true;
    return false;
  }

  public assertOperationsAllowed(): void {
    if (this.isGlobalKillSwitchActive()) {
      throw new Error('HALT: GLOBAL_KILL_SWITCH is ACTIVE in System_Settings. All email sending and writing operations are stopped.');
    }
  }

  public checkEmailQuota(): { remaining: number; buffer: number; hasQuota: boolean } {
    const settings = this.getSystemSettings();
    const buffer = Number(settings['DAILY_QUOTA_LIMIT']) || 100;
    return {
      remaining: this.mockQuota,
      buffer,
      hasQuota: this.mockQuota > buffer
    };
  }

  public setMockQuota(amount: number): void {
    this.mockQuota = amount;
  }

  public setSystemSetting(key: string, value: string | number | boolean): boolean {
    const existing = this.db.System_Settings.find(s => s.Setting_Name === key);
    if (existing) {
      existing.Value = value;
    } else {
      this.db.System_Settings.push({
        Setting_Name: key,
        Value: value,
        Description: 'Set via Config API'
      });
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Database.js Simulation
  // ---------------------------------------------------------------------
  public sanitizeAndValidateEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email provided: email must be a non-empty string.');
    }
    const clean = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(clean)) {
      throw new Error(`Invalid email format: "${email}"`);
    }
    return clean;
  }

  public normalizeNewsletterList(input: string | string[]): string {
    if (!input) return '';
    let items: string[] = [];
    if (Array.isArray(input)) {
      items = input;
    } else if (typeof input === 'string') {
      items = input.split(',');
    } else {
      items = [String(input)];
    }

    const set: Record<string, boolean> = {};
    items.forEach(item => {
      const clean = String(item).trim();
      if (clean) set[clean] = true;
    });

    return Object.keys(set).sort().join(', ');
  }

  public mergeNewsletterLists(existingList: string, newList: string | string[]): string {
    const combined = (existingList || '') + ',' + (Array.isArray(newList) ? newList.join(',') : (newList || ''));
    return this.normalizeNewsletterList(combined);
  }

  public getRows<K extends keyof DatabaseState>(sheetName: K): DatabaseState[K] {
    if (!this.db[sheetName]) {
      throw new Error(`Sheet not found: "${String(sheetName)}". Verify tab exists in spreadsheet.`);
    }
    return this.db[sheetName];
  }

  public updateCampaignStatus(campaignId: string, newStatus: string): boolean {
    const camp = this.db.Campaigns.find(c => String(c.campaign_id).trim() === String(campaignId).trim());
    if (!camp) {
      throw new Error(`Campaign not found with ID: ${campaignId}`);
    }
    camp.status = newStatus as any;
    return true;
  }

  public addOrUpdateSubscriber(subscriberData: Partial<Subscriber> & { email: string; replace_newsletters?: boolean }): {
    action: 'created' | 'updated';
    subscriber: Subscriber;
  } {
    this.assertOperationsAllowed();

    const cleanEmail = this.sanitizeAndValidateEmail(subscriberData.email);
    const existingIndex = this.db.Subscribers.findIndex(
      s => s.email.trim().toLowerCase() === cleanEmail
    );

    if (existingIndex !== -1) {
      // UPDATE
      const existing = this.db.Subscribers[existingIndex];
      const mergedNewsletters = subscriberData.replace_newsletters
        ? this.normalizeNewsletterList(subscriberData.subscribed_newsletters || '')
        : (subscriberData.subscribed_newsletters !== undefined
            ? this.mergeNewsletterLists(existing.subscribed_newsletters, subscriberData.subscribed_newsletters)
            : existing.subscribed_newsletters);

      const updatedSubscriber: Subscriber = {
        ...existing,
        first_name: subscriberData.first_name !== undefined ? subscriberData.first_name : existing.first_name,
        last_name: subscriberData.last_name !== undefined ? subscriberData.last_name : existing.last_name,
        subscribed_newsletters: mergedNewsletters,
        status: (subscriberData.status as any) || existing.status,
        source: subscriberData.source || existing.source,
        external_id: subscriberData.external_id !== undefined ? subscriberData.external_id : existing.external_id
      };

      this.db.Subscribers[existingIndex] = updatedSubscriber;
      return { action: 'updated', subscriber: updatedSubscriber };
    } else {
      // INSERT
      const newId = subscriberData.subscriber_id || `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const newSubscriber: Subscriber = {
        subscriber_id: newId,
        email: cleanEmail,
        first_name: subscriberData.first_name || '',
        last_name: subscriberData.last_name || '',
        subscribed_newsletters: this.normalizeNewsletterList(subscriberData.subscribed_newsletters || ''),
        status: subscriberData.status || 'active',
        source: subscriberData.source || 'web_api',
        external_id: subscriberData.external_id || '',
        created_at: new Date().toISOString()
      };

      this.db.Subscribers.push(newSubscriber);
      return { action: 'created', subscriber: newSubscriber };
    }
  }

  public isAlreadyDelivered(email: string, campaignOrDripId: string, stepNumber: string | number = 0): boolean {
    const cleanEmail = this.sanitizeAndValidateEmail(email);
    const targetKey = `${cleanEmail}_${String(campaignOrDripId).trim()}_${String(stepNumber).trim()}`;

    const match = this.db.Delivery_Logs.find(log => log.log_id_key === targetKey);
    if (!match) return false;

    const status = String(match.status).toLowerCase();
    return status === 'sent' || status === 'delivered' || status === 'opened' || status === 'success';
  }

  public logDelivery(logData: {
    email: string;
    campaign_or_drip_id: string;
    step_number?: string | number;
    subscriber_id?: string;
    variant_sent?: string;
    status?: string;
    error_message?: string;
    prevent_duplicates?: boolean;
    timestamp?: string;
  }): {
    success: boolean;
    log_id_key: string;
    row_appended: boolean;
    duplicate_skipped?: boolean;
    action?: string;
    message?: string;
  } {
    const cleanEmail = this.sanitizeAndValidateEmail(logData.email);
    const campaignId = String(logData.campaign_or_drip_id).trim();
    if (!campaignId) {
      throw new Error('logDelivery failed: campaign_or_drip_id is required.');
    }

    const stepNumber = logData.step_number !== undefined && logData.step_number !== null
      ? String(logData.step_number).trim()
      : '0';

    const logIdKey = `${cleanEmail}_${campaignId}_${stepNumber}`;
    const status = String(logData.status || 'sent').trim().toLowerCase();
    const timestamp = logData.timestamp || new Date().toISOString();

    const existingIndex = this.db.Delivery_Logs.findIndex(l => l.log_id_key === logIdKey);

    // Double-send prevention check
    if (existingIndex !== -1 && logData.prevent_duplicates !== false && status === 'sent') {
      const current = this.db.Delivery_Logs[existingIndex];
      const curStatus = String(current.status).toLowerCase();
      if (curStatus === 'sent' || curStatus === 'delivered' || curStatus === 'opened') {
        return {
          success: false,
          duplicate_skipped: true,
          row_appended: false,
          log_id_key: logIdKey,
          message: 'Double-send prevented: message already delivered for this key.'
        };
      }
    }

    // Update to 'opened' if already logged
    if (existingIndex !== -1 && status === 'opened') {
      this.db.Delivery_Logs[existingIndex].status = 'opened';
      return {
        success: true,
        log_id_key: logIdKey,
        row_appended: false,
        action: 'status_updated_to_opened'
      };
    }

    const newLog: DeliveryLog = {
      log_id_key: logIdKey,
      subscriber_id: logData.subscriber_id || '',
      email: cleanEmail,
      campaign_or_drip_id: campaignId,
      step_number: stepNumber,
      variant_sent: logData.variant_sent || 'A',
      timestamp,
      status,
      error_message: logData.error_message || ''
    };

    this.db.Delivery_Logs.push(newLog);

    return {
      success: true,
      log_id_key: logIdKey,
      row_appended: true
    };
  }

  // ---------------------------------------------------------------------
  // Phase 2: SendingEngine.js Simulation
  // ---------------------------------------------------------------------

  public hashString(str: string): number {
    let hash = 0;
    if (!str || str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  public compileEmailContent(
    rawTemplate: string,
    recipient: Partial<Subscriber> & { email: string },
    campaign: Campaign,
    newsletter: Newsletter,
    variant: 'A' | 'B'
  ): CompiledEmailPreview {
    const webAppUrl = 'https://script.google.com/macros/s/CURRENT_DEPLOYMENT_ID/exec';
    const campaignId = campaign.campaign_id;
    const newsletterId = newsletter.newsletter_id || campaign.newsletter_id;
    const subscriberId = recipient.subscriber_id || recipient.email;
    const cleanEmail = recipient.email.trim();

    const unsubUrl = `${webAppUrl}?action=unsubscribe&email=${encodeURIComponent(cleanEmail)}&c_id=${encodeURIComponent(campaignId)}&news_id=${encodeURIComponent(newsletterId)}`;
    const viewBrowserUrl = `${webAppUrl}?action=view_browser&c_id=${encodeURIComponent(campaignId)}&s_id=${encodeURIComponent(subscriberId)}`;

    // 1. Merge tags
    let compiled = rawTemplate
      .replace(/\{\{first_name\}\}/gi, recipient.first_name || 'Subscriber')
      .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
      .replace(/\{\{email\}\}/gi, cleanEmail)
      .replace(/\{\{unsubscribe_url\}\}/gi, unsubUrl)
      .replace(/\{\{view_in_browser\}\}/gi, viewBrowserUrl);

    // 2. Click tracking rewrites: <a href="...">
    const anchorRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(https?:\/\/[^"']+)\1([^>]*)>/gi;
    compiled = compiled.replace(anchorRegex, (match, quote, originalUrl, rest) => {
      if (originalUrl.includes('action=track_click')) return match;
      const trackingUrl = `${webAppUrl}?action=track_click&url=${encodeURIComponent(originalUrl)}&c_id=${encodeURIComponent(campaignId)}&s_id=${encodeURIComponent(subscriberId)}&variant=${variant}`;
      return `<a href=${quote}${trackingUrl}${quote}${rest}>`;
    });

    // 3. 1x1 Open tracking pixel
    const pixelUrl = `${webAppUrl}?action=track_open&c_id=${encodeURIComponent(campaignId)}&s_id=${encodeURIComponent(subscriberId)}&email=${encodeURIComponent(cleanEmail)}&variant=${variant}`;
    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;" alt="" />`;

    if (compiled.includes('</body>')) {
      compiled = compiled.replace('</body>', `${pixelTag}</body>`);
    } else {
      compiled = compiled + pixelTag;
    }

    const subject = variant === 'B' && campaign.subject_line_b ? campaign.subject_line_b : (campaign.subject_line_a || campaign.name);

    return {
      subject,
      variant,
      html: compiled,
      unsubUrl,
      viewBrowserUrl,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      },
      recipientEmail: cleanEmail
    };
  }

  public getRawContentForCampaign(campaign: Campaign, newsletter: Newsletter): string {
    const contentType = String(campaign.content_type || 'DOC_SHELL').toUpperCase();

    if (contentType === 'GMAIL_DRAFT') {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#1e293b;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:24px;border-radius:8px;">
          <h2 style="color:#0f172a;">Gmail Draft Clone: ${campaign.name}</h2>
          <p>Hi {{first_name}},</p>
          <p>This email was compiled from your Gmail Draft (source ID: <code>${campaign.source_id || 'draft_sample_id'}</code>).</p>
          <p><a href="https://news.ycombinator.com">Check out our latest architectural benchmarks &rarr;</a></p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="font-size:12px;color:#64748b;text-align:center;">
            <a href="{{view_in_browser}}">View in Browser</a> &bull; <a href="{{unsubscribe_url}}">Unsubscribe</a>
          </p>
        </div>
      </body></html>`;
    }

    // Default DOC_SHELL
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:24px;border-radius:8px;">
        <div style="border-bottom:2px solid #f59e0b;padding-bottom:12px;margin-bottom:16px;">
          <span style="font-size:12px;font-weight:bold;color:#f59e0b;text-transform:uppercase;">${newsletter.name || 'Newsletter'}</span>
          <h1 style="margin:4px 0 0;font-size:20px;color:#0f172a;">${campaign.subject_line_a || campaign.name}</h1>
        </div>
        <p>Dear {{first_name}},</p>
        <p>Welcome to our latest issue. This body was pulled from your master shell and Google Doc (source ID: <code>${campaign.source_id || 'doc_sample_id'}</code>).</p>
        <p>We are excited to share that our Google Apps Script engine now supports 4.5-minute timeout continuation triggers and RFC 8058 one-click unsubscription headers.</p>
        <div style="margin:24px 0;text-align:center;">
          <a href="https://example.com/deep-dive" style="background:#f59e0b;color:#0f172a;font-weight:bold;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Read the Full Engineering Post</a>
        </div>
        <p>Best regards,<br/>${newsletter.sender_alias || 'The Editorial Team'}</p>
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
          <p><a href="{{view_in_browser}}">View in Browser</a> &bull; <a href="{{unsubscribe_url}}">Manage Preferences / Unsubscribe</a></p>
        </div>
      </div>
    </body></html>`;
  }

  public sendTestEmail(campaignId: string, testEmail: string): {
    success: boolean;
    campaign_id: string;
    test_email: string;
    subject: string;
    preview: CompiledEmailPreview;
    status: string;
  } {
    const cleanEmail = this.sanitizeAndValidateEmail(testEmail);
    const campaign = this.db.Campaigns.find(c => c.campaign_id === campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found with ID: ${campaignId}`);
    }

    const newsletter = this.db.Newsletters.find(n => n.newsletter_id === campaign.newsletter_id) || {
      newsletter_id: campaign.newsletter_id,
      name: 'Newsletter Team',
      sender_alias: 'newsletter@sessionzero.solutions',
      reply_to: 'reply@sessionzero.solutions',
      default_template_id: '',
      created_at: new Date().toISOString()
    };

    const dummySubscriber: Subscriber = {
      subscriber_id: 'sub_test_preview',
      email: cleanEmail,
      first_name: 'TestFirstName',
      last_name: 'TestLastName',
      subscribed_newsletters: campaign.newsletter_id,
      status: 'active',
      source: 'test_dispatch',
      external_id: 'test_dummy',
      created_at: new Date().toISOString()
    };

    const rawTemplate = this.getRawContentForCampaign(campaign, newsletter);
    const preview = this.compileEmailContent(rawTemplate, dummySubscriber, campaign, newsletter, 'A');

    const subject = `[TEST] ${campaign.subject_line_a || campaign.name}`;
    preview.subject = subject;

    // Update campaign status to TEST_SENT
    this.updateCampaignStatus(campaignId, 'TEST_SENT');

    return {
      success: true,
      campaign_id: campaignId,
      test_email: cleanEmail,
      subject,
      preview,
      status: 'TEST_SENT'
    };
  }

  public executeCampaign(
    campaignId: string,
    options?: { simulateTimeoutAfterIndex?: number; startIndex?: number; allowDraftBypass?: boolean }
  ): {
    completed: boolean;
    campaign_id: string;
    status: string;
    sent_count: number;
    skipped_duplicates: number;
    failed_count: number;
    total_recipients: number;
    resumed_scheduled?: boolean;
    quota_paused?: boolean;
    message: string;
    dispatches?: Array<{
      email: string;
      variant: string;
      subject: string;
      log_id_key: string;
      status: string;
    }>;
  } {
    // 1. Kill switch check
    this.assertOperationsAllowed();

    // 2. Fetch campaign
    const campaign = this.db.Campaigns.find(c => c.campaign_id === campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found with ID: ${campaignId}`);
    }

    // 3. Pre-flight Status Check: Must be APPROVED or RESUMING
    const status = String(campaign.status || '').toUpperCase();
    if (!options?.allowDraftBypass && status !== 'APPROVED' && status !== 'RESUMING' && status !== 'SENDING') {
      throw new Error(`Refusing campaign dispatch: Status is "${status}". Campaign must be APPROVED or RESUMING before sending. (Run approve or sendTestEmail first).`);
    }

    // Set to SENDING
    this.updateCampaignStatus(campaignId, 'SENDING');

    const newsletter = this.db.Newsletters.find(n => n.newsletter_id === campaign.newsletter_id) || {
      newsletter_id: campaign.newsletter_id,
      name: 'Newsletter Team',
      sender_alias: 'newsletter@sessionzero.solutions',
      reply_to: 'reply@sessionzero.solutions',
      default_template_id: '',
      created_at: new Date().toISOString()
    };

    // Filter recipients subscribed to newsletter
    const recipients = this.db.Subscribers.filter(sub => {
      if (sub.status !== 'active') return false;
      if (!campaign.newsletter_id) return true;
      return (sub.subscribed_newsletters || '').includes(campaign.newsletter_id);
    });

    const totalRecipients = recipients.length;
    const startIndex = options?.startIndex || 0;
    const rawTemplate = this.getRawContentForCampaign(campaign, newsletter);

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const dispatches: any[] = [];

    const hasSubjectB = Boolean(campaign.subject_line_b && campaign.subject_line_b.trim().length > 0);
    const splitRatio = Number(campaign.test_split_ratio) || 50;

    for (let i = startIndex; i < totalRecipients; i++) {
      const recipient = recipients[i];

      // A. Timeout Guard Simulation (e.g. at specified index or > 4.5 min)
      if (options?.simulateTimeoutAfterIndex !== undefined && i >= options.simulateTimeoutAfterIndex) {
        // Save state
        const resumeState = {
          campaignId,
          lastProcessedIndex: i,
          lastProcessedEmail: recipient.email,
          totalRecipients,
          timestamp: Date.now()
        };
        this.simulatedProperties['CAMPAIGN_EXECUTION_STATE'] = JSON.stringify(resumeState);
        this.simulatedTriggers = [{
          id: `trig_${Date.now()}`,
          functionName: 'resumeCampaignExecution',
          time: Date.now() + 60000
        }];

        this.updateCampaignStatus(campaignId, 'RESUMING');

        return {
          completed: false,
          resumed_scheduled: true,
          campaign_id: campaignId,
          status: 'RESUMING',
          sent_count: sentCount,
          skipped_duplicates: skippedCount,
          failed_count: failedCount,
          total_recipients: totalRecipients,
          message: `4.5-Minute Guard triggered at index ${i} (${recipient.email}). State saved to PropertiesService; continuation trigger scheduled in 1 minute.`,
          dispatches
        };
      }

      // B. Quota Check
      const quotaCheck = this.checkEmailQuota();
      if (!quotaCheck.hasQuota) {
        this.updateCampaignStatus(campaignId, 'PAUSED_QUOTA');
        return {
          completed: false,
          quota_paused: true,
          campaign_id: campaignId,
          status: 'PAUSED_QUOTA',
          sent_count: sentCount,
          skipped_duplicates: skippedCount,
          failed_count: failedCount,
          total_recipients: totalRecipients,
          message: `Quota buffer limit hit: ${quotaCheck.remaining} remaining (safety buffer is ${quotaCheck.buffer}). Pausing campaign.`,
          dispatches
        };
      }

      // C. Double-Send Ledger Verification
      const stepNumber = '0';
      const compositeKey = `${recipient.email.toLowerCase()}_${campaignId}_${stepNumber}`;
      if (this.isAlreadyDelivered(recipient.email, campaignId, stepNumber)) {
        skippedCount++;
        dispatches.push({
          email: recipient.email,
          variant: 'N/A',
          subject: 'Skipped - Ledger Duplicate',
          log_id_key: compositeKey,
          status: 'SKIPPED_DUPLICATE'
        });
        continue;
      }

      // D. A/B Variant
      let variant: 'A' | 'B' = 'A';
      if (hasSubjectB) {
        const hash = this.hashString(recipient.email) % 100;
        variant = hash >= splitRatio ? 'B' : 'A';
      }

      // E. Compile Content & Headers
      const compiled = this.compileEmailContent(rawTemplate, recipient, campaign, newsletter, variant);

      // F. Send & Log Delivery
      this.logDelivery({
        email: recipient.email,
        campaign_or_drip_id: campaignId,
        step_number: stepNumber,
        subscriber_id: recipient.subscriber_id,
        variant_sent: variant,
        status: 'sent',
        prevent_duplicates: false
      });

      this.mockQuota = Math.max(0, this.mockQuota - 1);
      sentCount++;
      dispatches.push({
        email: recipient.email,
        variant,
        subject: compiled.subject,
        log_id_key: compositeKey,
        status: 'SENT'
      });
    }

    // Complete campaign
    this.updateCampaignStatus(campaignId, 'COMPLETED');
    delete this.simulatedProperties['CAMPAIGN_EXECUTION_STATE'];
    this.simulatedTriggers = [];

    return {
      completed: true,
      campaign_id: campaignId,
      status: 'COMPLETED',
      sent_count: sentCount,
      skipped_duplicates: skippedCount,
      failed_count: failedCount,
      total_recipients: totalRecipients,
      message: `Campaign completed successfully! Dispatched ${sentCount} emails (${skippedCount} duplicates skipped).`,
      dispatches
    };
  }

  public resumeCampaignExecution(): any {
    const rawState = this.simulatedProperties['CAMPAIGN_EXECUTION_STATE'];
    if (!rawState) {
      throw new Error('No campaign resume state found in PropertiesService.');
    }
    const state = JSON.parse(rawState);
    this.simulatedTriggers = []; // remove trigger
    return this.executeCampaign(state.campaignId, {
      startIndex: state.lastProcessedIndex,
      allowDraftBypass: true
    });
  }

  public runDripSequences(): {
    success: boolean;
    dispatched: number;
    errors: number;
    message: string;
    details: Array<{ email: string; sequence_id: string; step_number: number; status: string }>;
  } {
    this.assertOperationsAllowed();
    const quota = this.checkEmailQuota();
    if (!quota.hasQuota) {
      throw new Error(`Daily quota limit reached: ${quota.remaining} remaining.`);
    }

    const steps = this.db.Drip_Sequences.slice().sort((a, b) => a.step_number - b.step_number);
    const subscribers = this.db.Subscribers.filter(s => s.status === 'active');
    const details: any[] = [];
    let dispatched = 0;

    for (const sub of subscribers) {
      for (const step of steps) {
        if (step.newsletter_id && !(sub.subscribed_newsletters || '').includes(step.newsletter_id)) {
          continue;
        }

        const compositeKey = `${sub.email.toLowerCase()}_${step.sequence_id}_${step.step_number}`;
        const alreadySent = this.isAlreadyDelivered(sub.email, step.sequence_id, step.step_number);
        if (alreadySent) continue;

        // Check delay eligibility: In simulation, evaluate step
        this.logDelivery({
          email: sub.email,
          campaign_or_drip_id: step.sequence_id,
          step_number: step.step_number,
          subscriber_id: sub.subscriber_id,
          variant_sent: 'A',
          status: 'sent'
        });

        dispatched++;
        this.mockQuota = Math.max(0, this.mockQuota - 1);
        details.push({
          email: sub.email,
          sequence_id: step.sequence_id,
          step_number: step.step_number,
          status: 'DISPATCHED'
        });
        break; // Only 1 step per subscriber per run
      }
    }

    return {
      success: true,
      dispatched,
      errors: 0,
      message: `Drip engine executed. Dispatched ${dispatched} sequence step messages.`,
      details
    };
  }

  public processBounces(customBouncedEmail?: string): {
    success: boolean;
    processed_threads: number;
    bounced_emails: string[];
    updated_subscribers: number;
  } {
    // Simulated bounce scan
    const sampleBounces = customBouncedEmail ? [customBouncedEmail] : ['dev.marcus@matrix.net', 'invalid.recipient@unknown-domain-404.com'];
    let updated = 0;

    for (const email of sampleBounces) {
      const match = this.db.Subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
      if (match) {
        match.status = 'bounced';
        updated++;
      }
    }

    return {
      success: true,
      processed_threads: sampleBounces.length,
      bounced_emails: sampleBounces,
      updated_subscribers: updated
    };
  }

  // ---------------------------------------------------------------------
  // Router.js Simulation
  // ---------------------------------------------------------------------
  public simulateDoGet(params: Record<string, string>): {
    type: 'html' | 'pixel_gif' | 'json';
    content: string;
    mimeType: string;
    headers?: Record<string, string>;
  } {
    const action = (params.action || '').trim().toLowerCase();

    if (action === 'track_open') {
      const email = params.email || params.s_id;
      const campaignId = params.c_id || params.campaign_id || params.campaign_or_drip_id || 'unknown_campaign';
      const stepNumber = params.step_number || params.s_num || '0';
      const variant = params.variant || 'A';

      if (email && email.includes('@')) {
        try {
          this.logDelivery({
            email,
            campaign_or_drip_id: campaignId,
            step_number: stepNumber,
            variant_sent: variant,
            status: 'opened',
            prevent_duplicates: false
          });
        } catch (e) {
          // pixel logging warning
        }
      }

      return {
        type: 'pixel_gif',
        content: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        mimeType: 'image/gif',
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };
    }

    if (action === 'track_click') {
      const targetUrl = params.url ? decodeURIComponent(params.url) : 'https://example.com';
      const clickEmail = params.email || params.s_id || '';
      const clickCampId = params.c_id || params.campaign_id || '';

      if (clickEmail && clickEmail.includes('@') && clickCampId) {
        try {
          this.logDelivery({
            email: clickEmail,
            campaign_or_drip_id: clickCampId,
            step_number: params.step_number || '0',
            variant_sent: params.variant || 'A',
            status: 'opened',
            prevent_duplicates: false
          });
        } catch {
          // continue
        }
      }

      return {
        type: 'html',
        content: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${targetUrl}"><script>window.location.replace("${targetUrl}");</script></head><body>Redirecting to ${targetUrl}...</body></html>`,
        mimeType: 'text/html'
      };
    }

    if (action === 'unsubscribe') {
      const unsubEmail = params.email;
      if (unsubEmail) {
        try {
          this.addOrUpdateSubscriber({ email: unsubEmail, status: 'unsubscribed' });
        } catch {
          // continue
        }
      }
      return {
        type: 'html',
        content: `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>Preferences Updated</h2><p>You have been unsubscribed for ${unsubEmail || 'your email'}.</p></body></html>`,
        mimeType: 'text/html'
      };
    }

    if (action === 'view_browser') {
      const campId = params.c_id || params.campaign_id;
      const camp = this.db.Campaigns.find(c => c.campaign_id === campId) || this.db.Campaigns[0];
      const nlt = this.db.Newsletters.find(n => n.newsletter_id === camp?.newsletter_id) || this.db.Newsletters[0];
      const raw = this.getRawContentForCampaign(camp, nlt);
      const rendered = this.compileEmailContent(raw, { email: 'subscriber@sessionzero.solutions', first_name: 'Friend', last_name: '' }, camp, nlt, 'A');
      return {
        type: 'html',
        content: rendered.html,
        mimeType: 'text/html'
      };
    }

    if (action === 'ping') {
      return {
        type: 'json',
        content: JSON.stringify({
          success: true,
          status: 'online',
          kill_switch: this.isGlobalKillSwitchActive(),
          settings: this.getSystemSettings()
        }, null, 2),
        mimeType: 'application/json'
      };
    }

    // Default: serve Index.html
    return {
      type: 'html',
      content: `<!DOCTYPE html><html><head><title>Mailchimp Clone - Google Apps Script Portal</title></head><body><h1>Self-Hosted Mailchimp Engine (Apps Script)</h1><p>Phase 2 Operational</p></body></html>`,
      mimeType: 'text/html'
    };
  }

  public simulateDoPost(body: string | Record<string, any>): ApiResponse {
    try {
      let request: any = body;
      if (typeof body === 'string') {
        try {
          request = JSON.parse(body);
        } catch {
          return {
            success: false,
            timestamp: new Date().toISOString(),
            data: null,
            error: 'Invalid JSON format in request body.',
            code: 'INVALID_JSON'
          };
        }
      }

      if (!request || typeof request !== 'object') {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          data: null,
          error: 'Malformed request: Missing POST body payload.',
          code: 'EMPTY_BODY'
        };
      }

      const action = (request.action || '').trim();
      const payload = request.payload || {};

      if (!action) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          data: null,
          error: 'Missing required parameter: "action".',
          code: 'MISSING_ACTION'
        };
      }

      switch (action) {
        case 'send_test_email': {
          if (!payload.campaign_id || !payload.test_email) {
            return {
              success: false,
              timestamp: new Date().toISOString(),
              data: null,
              error: 'Validation error: "campaign_id" and "test_email" are required.',
              code: 'VALIDATION_ERROR'
            };
          }
          const res = this.sendTestEmail(payload.campaign_id, payload.test_email);
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: res,
            error: null,
            code: 'OK'
          };
        }

        case 'execute_campaign': {
          if (!payload.campaign_id) {
            return {
              success: false,
              timestamp: new Date().toISOString(),
              data: null,
              error: 'Validation error: "campaign_id" is required.',
              code: 'VALIDATION_ERROR'
            };
          }
          const res = this.executeCampaign(payload.campaign_id, {
            allowDraftBypass: Boolean(payload.allow_draft_bypass)
          });
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: res,
            error: null,
            code: 'OK'
          };
        }

        case 'resume_campaign': {
          const res = this.resumeCampaignExecution();
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: res,
            error: null,
            code: 'OK'
          };
        }

        case 'run_drip_sequences': {
          const res = this.runDripSequences();
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: res,
            error: null,
            code: 'OK'
          };
        }

        case 'process_bounces': {
          const res = this.processBounces(payload.bounced_email);
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: res,
            error: null,
            code: 'OK'
          };
        }

        case 'add_or_update_subscriber': {
          if (!payload.email) {
            return {
              success: false,
              timestamp: new Date().toISOString(),
              data: null,
              error: 'Validation error: "email" is required.',
              code: 'VALIDATION_ERROR'
            };
          }
          const res = this.addOrUpdateSubscriber(payload);
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: res,
            error: null,
            code: 'OK'
          };
        }

        case 'get_subscribers': {
          const subs = this.getRows('Subscribers');
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: { count: subs.length, subscribers: subs },
            error: null,
            code: 'OK'
          };
        }

        case 'create_campaign': {
          this.assertOperationsAllowed();
          if (!payload.name || !payload.newsletter_id) {
            return {
              success: false,
              timestamp: new Date().toISOString(),
              data: null,
              error: 'Validation error: "name" and "newsletter_id" are required.',
              code: 'VALIDATION_ERROR'
            };
          }
          const newCamp: Campaign = {
            campaign_id: payload.campaign_id || `camp_${Date.now().toString(36)}`,
            newsletter_id: String(payload.newsletter_id),
            name: String(payload.name),
            content_type: payload.content_type || 'html',
            source_id: payload.source_id || '',
            status: payload.status || 'DRAFT',
            scheduled_time: payload.scheduled_time || '',
            subject_line_a: payload.subject_line_a || payload.subject || '',
            subject_line_b: payload.subject_line_b || '',
            test_split_ratio: Number(payload.test_split_ratio) || 50
          };
          this.db.Campaigns.push(newCamp);
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: { action: 'created', campaign: newCamp },
            error: null,
            code: 'OK'
          };
        }

        case 'get_campaigns': {
          const camps = this.getRows('Campaigns');
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: { count: camps.length, campaigns: camps },
            error: null,
            code: 'OK'
          };
        }

        case 'log_delivery': {
          if (!payload.email || (!payload.campaign_id && !payload.campaign_or_drip_id)) {
            return {
              success: false,
              timestamp: new Date().toISOString(),
              data: null,
              error: 'Validation error: "email" and "campaign_id" are required.',
              code: 'VALIDATION_ERROR'
            };
          }
          const logRes = this.logDelivery(payload);
          return {
            success: logRes.success,
            timestamp: new Date().toISOString(),
            data: logRes,
            error: logRes.success ? null : (logRes.message || 'Delivery skipped'),
            code: logRes.duplicate_skipped ? 'DOUBLE_SEND_PREVENTED' : 'OK'
          };
        }

        case 'get_delivery_logs': {
          const logs = this.getRows('Delivery_Logs');
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: { count: logs.length, logs },
            error: null,
            code: 'OK'
          };
        }

        case 'get_system_settings': {
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: this.getSystemSettings(),
            error: null,
            code: 'OK'
          };
        }

        case 'check_quota': {
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: this.checkEmailQuota(),
            error: null,
            code: 'OK'
          };
        }

        case 'set_kill_switch': {
          const active = Boolean(payload.active);
          this.setSystemSetting('GLOBAL_KILL_SWITCH', active);
          return {
            success: true,
            timestamp: new Date().toISOString(),
            data: { kill_switch_active: active },
            error: null,
            code: 'OK'
          };
        }

        default:
          return {
            success: false,
            timestamp: new Date().toISOString(),
            data: null,
            error: `Unrecognized action: "${action}".`,
            code: 'UNKNOWN_ACTION'
          };
      }
    } catch (err: any) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        data: null,
        error: err.message,
        code: 'INTERNAL_ERROR'
      };
    }
  }
}
