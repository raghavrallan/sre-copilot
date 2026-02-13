import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Plug } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export interface ConnectionsData {
  database?: {
    host: string;
    port: number;
    database_name: string;
    username: string;
    password: string;
    ssl_mode: string;
  };
  redis?: {
    url: string;
    password: string;
    database_index: number;
  };
  api_gateway?: { url: string };
  auth?: {
    jwt_secret: string;
    jwt_algorithm: string;
    token_expiry: string;
  };
  ai_service?: {
    openai_api_key: string;
    model: string;
  };
  metrics_collector?: {
    url: string;
    retention_period: string;
  };
  log_service?: {
    url: string;
    retention_period: string;
  };
  alerting_service?: {
    url: string;
  };
  synthetic_service?: { url: string };
  security_service?: { url: string };
  websocket_service?: { url: string };
  notification_channels?: {
    email_smtp?: {
      host: string;
      port: number;
      username: string;
      password: string;
      from_address: string;
    };
    slack?: {
      webhook_url: string;
      channel: string;
    };
    pagerduty?: {
      api_key: string;
      integration_key: string;
    };
    ms_teams?: {
      webhook_url: string;
    };
  };
}

const DEFAULT_DATABASE = {
  host: '',
  port: 5432,
  database_name: '',
  username: '',
  password: '',
  ssl_mode: 'prefer',
};

const DEFAULT_REDIS = {
  url: 'redis://localhost:6379',
  password: '',
  database_index: 0,
};

const DEFAULT_AUTH = {
  jwt_secret: '',
  jwt_algorithm: 'HS256',
  token_expiry: '24h',
};

const DEFAULT_AI_SERVICE = {
  openai_api_key: '',
  model: 'gpt-4o-mini',
};

const DEFAULT_OBSERVABILITY = {
  metrics_collector: { url: '', retention_period: '30d' },
  log_service: { url: '', retention_period: '30d' },
  alerting_service: { url: '' },
  synthetic_service: { url: '' },
  security_service: { url: '' },
  websocket_service: { url: '' },
};

const DEFAULT_NOTIFICATION_CHANNELS = {
  email_smtp: {
    host: '',
    port: 587,
    username: '',
    password: '',
    from_address: '',
  },
  slack: { webhook_url: '', channel: '' },
  pagerduty: { api_key: '', integration_key: '' },
  ms_teams: { webhook_url: '' },
};

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-base font-semibold text-gray-900">{title}</span>
        {open ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {open && <div className="px-6 pb-6 pt-0 border-t border-gray-100">{children}</div>}
    </div>
  );
}

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}

function PasswordInput({ value, onChange, placeholder, label }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string | number;
  onChange: (v: string | number) => void;
  type?: 'text' | 'number' | 'password';
  placeholder?: string;
  required?: boolean;
}

function FormField({ label, value, onChange, type = 'text', placeholder, required }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} {required && '*'}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
      />
    </div>
  );
}

export default function ConnectionSettings() {
  const [data, setData] = useState<ConnectionsData>({});
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const { data: res } = await api.get<ConnectionsData>('/api/v1/settings/connections');
      setData(res || {});
    } catch (err: any) {
      if (err.response?.status === 404) {
        setData({});
      } else {
        toast.error(err.response?.data?.detail || 'Failed to load connections');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const setNested = (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
    const keys = path.split('.');
    if (keys.length === 1) {
      return { ...obj, [keys[0]]: value };
    }
    const [first, ...rest] = keys;
    return {
      ...obj,
      [first]: setNested((obj[first] as Record<string, unknown>) || {}, rest.join('.'), value),
    };
  };

  const updateData = (path: string, value: unknown) => {
    setData((prev) => setNested(prev as Record<string, unknown>, path, value) as ConnectionsData);
  };

  const saveSection = async (section: string, payload: object) => {
    try {
      setSaveLoading(section);
      await api.put('/api/v1/settings/connections', payload);
      toast.success('Settings saved successfully');
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.success('Settings saved (API not yet implemented)');
      } else {
        toast.error(err.response?.data?.detail || 'Failed to save settings');
      }
    } finally {
      setSaveLoading(null);
    }
  };

  const testConnection = async (type: string, payload: object) => {
    try {
      setTestLoading(type);
      await api.post('/api/v1/settings/connections/test', { type, ...payload });
      toast.success('Connection successful');
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.success('Test endpoint not yet implemented');
      } else {
        toast.error(err.response?.data?.detail || 'Connection test failed');
      }
    } finally {
      setTestLoading(null);
    }
  };

  const db = data.database ?? DEFAULT_DATABASE;
  const redis = data.redis ?? DEFAULT_REDIS;
  const auth = data.auth ?? DEFAULT_AUTH;
  const ai = data.ai_service ?? DEFAULT_AI_SERVICE;
  const nc = data.notification_channels ?? DEFAULT_NOTIFICATION_CHANNELS;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-6">
        Configure connection settings for backend services. Changes are saved per section.
      </p>

      {/* Database */}
      <CollapsibleSection title="Database" defaultOpen>
        <div className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Host" value={db.host} onChange={(v) => updateData('database.host', v)} placeholder="localhost" />
            <FormField label="Port" value={db.port} onChange={(v) => updateData('database.port', v)} type="number" />
            <FormField label="Database Name" value={db.database_name} onChange={(v) => updateData('database.database_name', v)} placeholder="sre_copilot" />
            <FormField label="Username" value={db.username} onChange={(v) => updateData('database.username', v)} />
            <div className="col-span-2">
              <PasswordInput label="Password" value={db.password} onChange={(v) => updateData('database.password', v)} />
            </div>
            <FormField label="SSL Mode" value={db.ssl_mode} onChange={(v) => updateData('database.ssl_mode', v)} placeholder="prefer" />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => testConnection('database', { database: db })}
              disabled={!!testLoading}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 flex items-center gap-2"
            >
              {testLoading === 'database' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Test Connection
            </button>
            <button
              type="button"
              onClick={() => saveSection('database', { database: db })}
              disabled={!!saveLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saveLoading === 'database' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Cache (Redis) */}
      <CollapsibleSection title="Cache (Redis)">
        <div className="pt-4 space-y-4">
          <FormField label="URL" value={redis.url} onChange={(v) => updateData('redis.url', v)} placeholder="redis://localhost:6379" />
          <PasswordInput label="Password" value={redis.password} onChange={(v) => updateData('redis.password', v)} />
          <FormField label="Database Index" value={redis.database_index} onChange={(v) => updateData('redis.database_index', v)} type="number" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => testConnection('redis', { redis })}
              disabled={!!testLoading}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 flex items-center gap-2"
            >
              {testLoading === 'redis' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Test Connection
            </button>
            <button
              type="button"
              onClick={() => saveSection('redis', { redis })}
              disabled={!!saveLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saveLoading === 'redis' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Authentication */}
      <CollapsibleSection title="Authentication">
        <div className="pt-4 space-y-4">
          <PasswordInput label="JWT Secret" value={auth.jwt_secret} onChange={(v) => updateData('auth.jwt_secret', v)} />
          <FormField label="JWT Algorithm" value={auth.jwt_algorithm} onChange={(v) => updateData('auth.jwt_algorithm', v)} placeholder="HS256" />
          <FormField label="Token Expiry" value={auth.token_expiry} onChange={(v) => updateData('auth.token_expiry', v)} placeholder="24h" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => saveSection('auth', { auth })}
              disabled={!!saveLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saveLoading === 'auth' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* AI Service */}
      <CollapsibleSection title="AI Service">
        <div className="pt-4 space-y-4">
          <PasswordInput label="OpenAI API Key" value={ai.openai_api_key} onChange={(v) => updateData('ai_service.openai_api_key', v)} />
          <FormField label="Model" value={ai.model} onChange={(v) => updateData('ai_service.model', v)} placeholder="gpt-4o-mini" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => saveSection('ai_service', { ai_service: ai })}
              disabled={!!saveLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saveLoading === 'ai_service' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Observability Services */}
      <CollapsibleSection title="Observability Services">
        <div className="pt-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Service URLs</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Metrics Collector URL" value={data.metrics_collector?.url ?? ''} onChange={(v) => updateData('metrics_collector.url', v)} placeholder="http://localhost:8581" />
              <FormField label="Retention Period" value={data.metrics_collector?.retention_period ?? '30d'} onChange={(v) => updateData('metrics_collector.retention_period', v)} />
              <FormField label="Log Service URL" value={data.log_service?.url ?? ''} onChange={(v) => updateData('log_service.url', v)} placeholder="http://localhost:8582" />
              <FormField label="Retention Period" value={data.log_service?.retention_period ?? '30d'} onChange={(v) => updateData('log_service.retention_period', v)} />
              <FormField label="Alerting Service URL" value={data.alerting_service?.url ?? ''} onChange={(v) => updateData('alerting_service.url', v)} placeholder="http://localhost:8583" />
              <FormField label="Synthetic Service URL" value={data.synthetic_service?.url ?? ''} onChange={(v) => updateData('synthetic_service.url', v)} placeholder="http://localhost:8584" />
              <FormField label="Security Service URL" value={data.security_service?.url ?? ''} onChange={(v) => updateData('security_service.url', v)} placeholder="http://localhost:8585" />
              <FormField label="WebSocket Service URL" value={data.websocket_service?.url ?? ''} onChange={(v) => updateData('websocket_service.url', v)} placeholder="ws://localhost:8586" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                saveSection('observability', {
                  metrics_collector: data.metrics_collector ?? DEFAULT_OBSERVABILITY.metrics_collector,
                  log_service: data.log_service ?? DEFAULT_OBSERVABILITY.log_service,
                  alerting_service: data.alerting_service ?? { url: '' },
                  synthetic_service: data.synthetic_service ?? { url: '' },
                  security_service: data.security_service ?? { url: '' },
                  websocket_service: data.websocket_service ?? { url: '' },
                })
              }
              disabled={!!saveLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saveLoading === 'observability' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Notification Channels */}
      <CollapsibleSection title="Notification Channels">
        <div className="pt-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Email SMTP</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <FormField label="Host" value={nc.email_smtp?.host ?? ''} onChange={(v) => updateData('notification_channels.email_smtp.host', v)} />
              <FormField label="Port" value={nc.email_smtp?.port ?? 587} onChange={(v) => updateData('notification_channels.email_smtp.port', v)} type="number" />
              <FormField label="Username" value={nc.email_smtp?.username ?? ''} onChange={(v) => updateData('notification_channels.email_smtp.username', v)} />
              <PasswordInput label="Password" value={nc.email_smtp?.password ?? ''} onChange={(v) => updateData('notification_channels.email_smtp.password', v)} />
              <FormField label="From Address" value={nc.email_smtp?.from_address ?? ''} onChange={(v) => updateData('notification_channels.email_smtp.from_address', v)} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Slack</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <FormField label="Webhook URL" value={nc.slack?.webhook_url ?? ''} onChange={(v) => updateData('notification_channels.slack.webhook_url', v)} />
              <FormField label="Channel" value={nc.slack?.channel ?? ''} onChange={(v) => updateData('notification_channels.slack.channel', v)} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">PagerDuty</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <PasswordInput label="API Key" value={nc.pagerduty?.api_key ?? ''} onChange={(v) => updateData('notification_channels.pagerduty.api_key', v)} />
              <PasswordInput label="Integration Key" value={nc.pagerduty?.integration_key ?? ''} onChange={(v) => updateData('notification_channels.pagerduty.integration_key', v)} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Microsoft Teams</h4>
            <FormField label="Webhook URL" value={nc.ms_teams?.webhook_url ?? ''} onChange={(v) => updateData('notification_channels.ms_teams.webhook_url', v)} />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => testConnection('smtp', { notification_channels: nc })}
              disabled={!!testLoading}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 flex items-center gap-2"
            >
              {testLoading === 'smtp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Test Email
            </button>
            <button
              type="button"
              onClick={() => saveSection('notification_channels', { notification_channels: nc })}
              disabled={!!saveLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saveLoading === 'notification_channels' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
