import TargetManagementCard from "./target-management-card";

export default function NilaiTransaksiTab() {
  return (
    <TargetManagementCard
      card_title="Target Nilai Transaksi"
      endpoint="/api/target-nilai-transaksi"
      empty_message="Tidak ada target nilai transaksi yang cocok dengan filter."
      target_label="Target Nilai Transaksi"
      create_title="Tambah Target Nilai Transaksi"
      create_description="Tambahkan target nilai transaksi baru untuk rentang tanggal tertentu."
      edit_title="Edit Target Nilai Transaksi"
      edit_description="Perbarui rentang tanggal dan nilai target transaksi."
      delete_title="Hapus Target Nilai Transaksi"
      delete_description_template="Target untuk rentang {range} akan dihapus dari daftar aktif."
      target_placeholder="Masukkan nilai target, contoh 150000"
      target_helper="Target nilai transaksi menggunakan angka bulat tanpa desimal."
      target_value_format="currency"
      import_date_mode="range"
    />
  );
}
