// 飞书 OpenAPI 客户端配置接口
export interface FeishuOpenApiConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableId: string;
}

// 获取 tenant_access_token
const getTenantAccessToken = async (appId: string, appSecret: string): Promise<string> => {
  const res = await fetch('/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }
  return data.tenant_access_token;
};

// 获取表格记录
export const fetchFeishuRecords = async (config: FeishuOpenApiConfig) => {
  const token = await getTenantAccessToken(config.appId, config.appSecret);
  const records: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL(`/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`, window.location.origin);
    url.searchParams.append('page_size', '100');
    if (pageToken) {
      url.searchParams.append('page_token', pageToken);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`[Feishu OpenAPI] fetch records error: ${data.msg}`);
    }

    if (data.data?.items) {
      records.push(...data.data.items);
    }
    
    pageToken = data.data?.has_more ? data.data?.page_token : undefined;
  } while (pageToken);

  return records;
};

// 获取单条表格记录
export const getFeishuRecord = async (config: FeishuOpenApiConfig, recordId: string) => {
  const token = await getTenantAccessToken(config.appId, config.appSecret);
  const res = await fetch(`/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`[Feishu OpenAPI] get record error: ${data.msg}`);
  }
  return data.data.record;
};

// 更新表格记录
export const updateFeishuRecord = async (config: FeishuOpenApiConfig, recordId: string, fields: Record<string, any>) => {
  const token = await getTenantAccessToken(config.appId, config.appSecret);
  const res = await fetch(`/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      fields,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`[Feishu OpenAPI] update record error: ${data.msg}`);
  }
  return data.data;
};

// 解析多维表格 URL，提取 appToken 和 tableId
export const parseFeishuUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/base\/([a-zA-Z0-9]+)/);
    const appToken = match ? match[1] : '';
    const tableId = parsed.searchParams.get('table') || '';
    
    if (!appToken || !tableId) {
      throw new Error('URL 格式不正确，无法提取 appToken 或 tableId');
    }
    
    return { appToken, tableId };
  } catch (e) {
    throw new Error('无效的 URL');
  }
};
