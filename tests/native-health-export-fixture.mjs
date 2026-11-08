// Public fixed export contract; no credentials or real records.
export const nativeColumns = {
  native_installations: ['installation_id','client_id','epoch','created','refreshed','idle_expires','absolute_expires','revoked'],
  native_health_connections: ['connection_id','installation_id','epoch','connection_epoch','types_json','created','expires','revoked','last_received_at','last_observed_at'],
  native_health_batches: ['request_id','connection_id','body_sha256','body_bytes','body_chunk_count','receipt','received'],
  native_health_batch_chunks: ['request_id','chunk_index','byte_offset','bytes','sha256','data_base64'],
  native_health_records: ['version_id','installation_id','record_type','source_package','record_id','version_key','source_modified','body_sha256','body_bytes','body_chunk_count','deleted','request_id','received'],
  native_health_record_chunks: ['version_id','chunk_index','byte_offset','bytes','sha256','data_base64'],
  native_health_heads: ['installation_id','record_type','source_package','record_id','version_id'],
};
export const nativeJSONColumns = table => table === 'native_health_connections' ? ['types_json'] : table === 'native_health_batches' ? ['receipt'] : [];
export const emptyNativeData = () => Object.fromEntries(Object.keys(nativeColumns).map(table => [table,[]]));
export const nativeMetadata = data => Object.fromEntries(Object.entries(nativeColumns).map(([table,columns]) => [table,{rowCount:data[table].length,columns,jsonColumns:nativeJSONColumns(table)}]));
