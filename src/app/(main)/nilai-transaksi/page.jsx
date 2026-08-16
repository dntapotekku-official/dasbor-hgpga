"use client";

import FeatureTemplatePage from "@/components/feature-template-page";

export default function NilaiTransaksiPage() {
  return (
    <FeatureTemplatePage
      title="Nilai Transaksi"
      description="Pantau ringkasan dan tren nilai transaksi."
      sectionTitle="Data Nilai Transaksi"
      sectionDescription="Area ini disiapkan untuk menampilkan total, tren, dan distribusi transaksi."
      emptyMessage="Template nilai transaksi siap dihubungkan dengan data."
    />
  );
}
