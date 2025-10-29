/**
 * 阿里云表格存储（TableStore）元数据缓存适配器
 * 类似 OpenNext 的 DynamoDB 元数据缓存层
 * 
 * 作用：
 * 1. 存储轻量级元数据（lastModified、revalidatedAt）
 * 2. 快速验证内存缓存是否仍然有效
 * 3. 避免不必要的完整 OSS 读取
 */

const TableStore = require('tablestore');
const { debug, error: logError, warn } = require('../utils/logger');

/**
 * 表格存储配置
 */
function getTableStoreConfig() {
  const {
    TABLESTORE_ENDPOINT,
    TABLESTORE_INSTANCE,
    TABLESTORE_ACCESS_KEY_ID,
    TABLESTORE_ACCESS_KEY_SECRET,
    TABLESTORE_TABLE_NAME,
  } = process.env;

  if (!TABLESTORE_ENDPOINT || !TABLESTORE_INSTANCE || 
      !TABLESTORE_ACCESS_KEY_ID || !TABLESTORE_ACCESS_KEY_SECRET) {
    return null;
  }

  return {
    accessKeyId: TABLESTORE_ACCESS_KEY_ID,
    accessKeySecret: TABLESTORE_ACCESS_KEY_SECRET,
    endpoint: TABLESTORE_ENDPOINT,
    instancename: TABLESTORE_INSTANCE,
    tableName: TABLESTORE_TABLE_NAME || 'nextjs_cache_metadata',
  };
}

// 全局客户端实例
let client = null;
let tableName = null;

/**
 * 获取表格存储客户端
 */
function getClient() {
  if (!client) {
    const config = getTableStoreConfig();
    if (!config) {
      return null;
    }
    
    client = new TableStore.Client({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.accessKeySecret,
      endpoint: config.endpoint,
      instancename: config.instancename,
    });
    
    tableName = config.tableName;
    
    console.log('✅ TableStore 元数据缓存已启用');
    console.log(`📋 Instance: ${config.instancename}`);
    console.log(`📊 Table: ${tableName}`);
  }
  return client;
}

/**
 * 构建主键
 */
function buildPrimaryKey(key) {
  const { NEXT_BUILD_ID } = process.env;
  const buildId = NEXT_BUILD_ID || 'default';
  
  return [
    { cache_id: `${buildId}/${key}` },
    { type: 'meta' }
  ];
}

/**
 * 元数据缓存适配器
 */
const tablestoreMetadata = {
  name: 'tablestore-metadata',

  /**
   * 获取元数据
   * @returns {Object|null} { lastModified, revalidatedAt, deleted, size }
   */
  async getMeta(key) {
    const client = getClient();
    if (!client) return null;

    try {
      const params = {
        tableName,
        primaryKey: buildPrimaryKey(key),
        maxVersions: 1,
      };

      const result = await client.getRow(params);
      
      if (!result.row || result.row.attributes.length === 0) {
        debug(`TableStore 元数据不存在: ${key}`);
        return null;
      }
      // 解析属性
      const attrs = {};
      result.row.attributes.forEach(({columnName,columnValue}) => {
        attrs[columnName] = columnValue;
      });

      debug(`TableStore 元数据命中: ${key}`, attrs);

      return {
        lastModified: attrs.lastModified || Date.now(),
        revalidatedAt: attrs.revalidatedAt || 0,
        deleted: attrs.deleted || false,
        size: attrs.size || 0,
      };
    } catch (err) {
      logError(`获取 TableStore 元数据失败: ${key}`, err);
      return null;
    }
  },

  /**
   * 设置元数据
   */
  async setMeta(key, metadata) {
    const client = getClient();
    if (!client) return;

    try {
      const params = {
        tableName,
        condition: new TableStore.Condition(
          TableStore.RowExistenceExpectation.IGNORE,
          null
        ),
        primaryKey: buildPrimaryKey(key),
        attributeColumns: [
          { lastModified: Number(metadata.lastModified.toFixed(0)) || Number(Date.now().toFixed(0)) },
          { revalidatedAt: Number(metadata.revalidatedAt.toFixed(0)) || Number(Date.now().toFixed(0)) },
          { deleted: metadata.deleted || false },
          { size: metadata.size || 0 },
        ],
      };

      await client.putRow(params);
      debug(`TableStore 元数据已更新: ${key}`);
    } catch (err) {
      logError(`设置 TableStore 元数据失败: ${key}`, err);
    }
  },

  /**
   * 删除元数据（标记为已删除）
   */
  async deleteMeta(key) {
    const client = getClient();
    if (!client) return;

    try {
      await this.setMeta(key, {
        deleted: true,
        revalidatedAt: Date.now(),
      });
      debug(`TableStore 元数据已标记删除: ${key}`);
    } catch (err) {
      logError(`删除 TableStore 元数据失败: ${key}`, err);
    }
  },

  /**
   * 批量获取元数据（用于 tag 查询）
   */
  async batchGetMeta(keys) {
    const client = getClient();
    if (!client || keys.length === 0) return [];

    try {
      const params = {
        tables: [{
          tableName,
          primaryKey: keys.map(key => buildPrimaryKey(key)),
          maxVersions: 1,
        }],
      };

      const result = await client.batchGetRow(params);
      
      const metaList = [];
      if (result.tables && result.tables[0]) {
        result.tables[0].rows.forEach((row, index) => {
          if (row.isOk && row.row && row.row.attributes.length > 0) {
            const attrs = {};
            row.row.attributes.forEach(([name, value]) => {
              attrs[name] = value;
            });
            metaList.push({
              key: keys[index],
              ...attrs,
            });
          }
        });
      }

      debug(`批量获取 TableStore 元数据: ${keys.length} 条`);
      return metaList;
    } catch (err) {
      logError('批量获取 TableStore 元数据失败', err);
      return [];
    }
  },
};

module.exports = tablestoreMetadata;

