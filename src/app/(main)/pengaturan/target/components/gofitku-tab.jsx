import TargetManagementCard from "./target-management-card";

export default function GofitkuTab() {
  return (
    <TargetManagementCard
      card_title="Target GoFitKu"
      endpoint="/api/target-gofitku"
      empty_message="Tidak ada target GoFitKu yang cocok dengan filter."
      target_label="Target GoFitKu"
      create_title="Tambah Target GoFitKu"
      create_description="Tambahkan target penempatan baru untuk rentang tanggal tertentu."
      edit_title="Edit Target GoFitKu"
      edit_description="Perbarui rentang tanggal dan nilai target GoFitKu."
      delete_title="Hapus Target GoFitKu"
      delete_description_template="Target untuk rentang {range} akan disembunyikan dari daftar aktif."
      target_placeholder="Masukkan nilai target"
      target_helper="Target GoFitKu menggunakan angka bulat."
      target_value_format="integer"
      delete_payload_key="uuid_target_gofitku"
      import_date_mode="range"
      entity_key="uuid_outlet_insanku"
      entity_name_key="insanku_name"
      entity_label="Penempatan"
      table_entity_label="Nama"
      secondary_entity_name_key="outlet_name"
      secondary_entity_label="Outlet"
      show_nik={false}
      split_entity_filters
      enable_bulk_create
      enable_bulk_target_update
    />
  );
}
