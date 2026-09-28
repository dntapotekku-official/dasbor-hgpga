import TargetManagementCard from "./target-management-card";

export default function BasketSizeTab() {
  return (
    <TargetManagementCard
      card_title="Target Basket Size"
      endpoint="/api/target-basket-size"
      empty_message="Tidak ada target basket size yang cocok dengan filter."
      target_label="Target Basket Size"
      create_title="Tambah Target Basket Size"
      create_description="Tambahkan target basket size baru untuk rentang tanggal tertentu."
      edit_title="Edit Target Basket Size"
      edit_description="Perbarui rentang tanggal dan nilai target basket size."
      delete_title="Hapus Target Basket Size"
      delete_description_template="Target untuk rentang {range} akan dihapus dari daftar aktif."
      target_placeholder="Masukkan nilai target, contoh 2.08"
      target_helper="Gunakan titik untuk desimal, misalnya 2.08."
      target_value_format="decimal"
      import_date_mode="range"
    />
  );
}
