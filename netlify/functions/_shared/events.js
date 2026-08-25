// Écriture dans le journal unique repair_app_events (tâches réalisées +
// anomalies), utilisé par assign.js et anomaly.js.

export async function fetchDeviceInfo(admin, barcode) {
  const { data: rows } = await admin
    .from('export_devices_report')
    .select('area, subarea, brand_name, service_sub_category_name')
    .eq('barcode', barcode)
    .limit(1)
  return rows?.[0] || null
}

export async function logTaskDone(admin, barcode, technicien, action) {
  try {
    const device = await fetchDeviceInfo(admin, barcode)
    await admin.from('repair_app_events').insert({
      event_type: 'task_done',
      barcode,
      technicien: technicien || null,
      action: action || null,
      area: device?.area || null,
      subarea: device?.subarea || null,
      brand_name: device?.brand_name || null,
      service_sub_category_name: device?.service_sub_category_name || null,
    })
  } catch (e) {
    console.error('Erreur journalisation tâche réalisée :', e.message)
  }
}

export async function logAnomaly(admin, { barcode, technicien, type, commentaire }) {
  const device = await fetchDeviceInfo(admin, barcode)
  const { error } = await admin.from('repair_app_events').insert({
    event_type: 'anomaly',
    barcode,
    technicien: technicien || null,
    anomaly_type: type,
    commentaire: commentaire || null,
    area: device?.area || null,
    subarea: device?.subarea || null,
    brand_name: device?.brand_name || null,
    service_sub_category_name: device?.service_sub_category_name || null,
  })
  if (error) throw error
}
