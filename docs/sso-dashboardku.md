# SSO DashboardKU untuk Performance Report

Dokumen ini menjelaskan implementasi login SSO dari DashboardKU ke Performance Report. Login username/password lokal tetap tersedia.

## Alur Login

1. User membuka Performance Report dan klik **Masuk dengan DashboardKU**.
2. Browser diarahkan ke `/auth/sso/dashboardku/start`.
3. Performance Report membuat `state`, `nonce`, dan PKCE `code_verifier`.
4. Browser diarahkan ke DashboardKU untuk authorization.
5. DashboardKU redirect kembali ke `/auth/sso/dashboardku/callback` dengan `code`.
6. Performance Report menukar `code` ke token melalui backend.
7. Performance Report memvalidasi `id_token`, issuer, audience, expiry, nonce, dan signature JWKS.
8. Performance Report mencari mapping `issuer + subject` ke akun lokal.
9. Jika mapping aktif, Performance Report membuat session lokal `user_session`.

## Endpoint di Performance Report

| Endpoint | Fungsi |
| --- | --- |
| `/auth/sso/dashboardku/start` | Memulai login SSO dan redirect ke DashboardKU. |
| `/auth/sso/dashboardku/callback` | Menerima authorization code, validasi token, lalu membuat session lokal. |

## Environment Variable

```env
DASHBOARDKU_OIDC_ISSUER=https://dashboardku.apotekku.com
DASHBOARDKU_OIDC_CLIENT_ID=performance-report
DASHBOARDKU_OIDC_CLIENT_SECRET=isi_secret_dari_dashboardku
DASHBOARDKU_OIDC_REDIRECT_URI=https://domain-performance-report.com/auth/sso/dashboardku/callback
DASHBOARDKU_OIDC_POST_LOGIN_REDIRECT=/penjualan-gofitku
```

Opsional jika DashboardKU tidak menyediakan discovery endpoint standar:

```env
DASHBOARDKU_OIDC_DISCOVERY_URL=https://dashboardku.apotekku.com/.well-known/openid-configuration
DASHBOARDKU_OIDC_AUTHORIZATION_ENDPOINT=https://dashboardku.apotekku.com/oauth/authorize
DASHBOARDKU_OIDC_TOKEN_ENDPOINT=https://dashboardku.apotekku.com/oauth/token
DASHBOARDKU_OIDC_JWKS_URI=https://dashboardku.apotekku.com/.well-known/jwks.json
DASHBOARDKU_OIDC_SCOPE=openid profile email
DASHBOARDKU_OIDC_ALLOWED_REDIRECTS=/,/penjualan-gofitku
```

## Mapping Akun

SSO tidak otomatis membuat akun lokal. Admin harus menautkan akun DashboardKU ke akun Performance Report di tabel `tbl_sso_account_link`.

Field penting:

| Field | Keterangan |
| --- | --- |
| `issuer` | Issuer DashboardKU, contoh `https://dashboardku.apotekku.com`. |
| `subject` | Claim `sub` dari user DashboardKU. |
| `account_uuid` | UUID akun lokal Performance Report. |
| `account_type` | `admin` atau `outlet`. |
| `status` | `active` atau `revoked`. |

Contoh mapping outlet:

```sql
INSERT INTO tbl_sso_account_link (
  uuid,
  issuer,
  subject,
  account_uuid,
  account_type,
  status,
  updated_at
) VALUES (
  UUID(),
  'https://dashboardku.apotekku.com',
  'subject-user-dashboardku',
  'uuid-outlet-performance-report',
  'outlet',
  'active',
  NOW(3)
);
```

Jika akun belum tertaut, callback menolak login dan mengarahkan user kembali ke halaman login dengan pesan error.

## Catatan Keamanan

- Authorization Code memakai PKCE `S256`.
- `state`, `nonce`, dan `code_verifier` disimpan sementara dalam cookie `httpOnly`.
- Cookie sementara berlaku 10 menit.
- Token DashboardKU hanya dipakai untuk membuktikan identitas.
- Role, akses menu, dan akses outlet tetap diambil dari database Performance Report.
- Session akhir tetap memakai cookie lokal `user_session` seperti login manual.
