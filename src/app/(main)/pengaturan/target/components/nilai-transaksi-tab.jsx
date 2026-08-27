import TargetManagementCard from "./target-management-card";

export default function NilaiTransaksiTab() {
  return (
    <TargetManagementCard
      card_title="Target Nilai Transaksi"
      endpoint="/api/target-nilai-transaksi"
      empty_message="Tidak ada target nilai transaksi yang cocok dengan filter."
      target_label="Target Nilai Transaksi"
      create_title="Tambah Target Nilai Transaksi"
      create_description="Tambahkan target nilai transaksi baru untuk range tanggal tertentu."
      edit_title="Edit Target Nilai Transaksi"
      edit_description="Perbarui range tanggal dan nilai target transaksi."
      delete_title="Hapus Target Nilai Transaksi"
      delete_description_template="Target untuk range {range} akan dihapus dari daftar aktif."
      target_placeholder="Masukkan nilai target"
      search_placeholder="Cari target..."
      target_value_format="integer"
      import_date_mode="single"
    />
  );
}
