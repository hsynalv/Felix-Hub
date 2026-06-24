# Faz 5 — Test Temizliği ve Manuel Doğrulama

**Öncelik:** 5 / 5  
**Karmaşıklık:** M  
**Durum:** Planlandı  
**Gate:** Faz 4 tamamlanmadan başlanmaz

---

## Hedef

Step 2 feature'ları tamamlandıktan **sonra** mevcut test suite'i pragmatik şekilde ele almak: **gereksiz / obsolete test kodunu kaldırmak**, kırık testleri düzeltmek ve **manuel test checklist'lerini** resmi doğrulama yöntemi olarak dokümante etmek. Vitest coverage genişletmesi hedef değildir.

---

## Mevcut Durum (Codebase Referansı)

| Metrik | Değer | Kaynak |
|--------|-------|--------|
| Toplam test | 778 | [current-state.md](./current-state.md) |
| Geçen | 664 | |
| Başarısız | 114 | |
| Başarısız dosya | 26 / 48 | |
| Test config | `mcp-server/vitest.config.js` | |
| Coverage hedefi | core %85, plugins %60–75 | vitest config |

### Başarısızlık kök nedenleri ([technical-debt.md](./technical-debt.md))

1. Audit API uyumsuzluğu — `auditEntry is not a function` (workspace, secrets)
2. Eski mock beklentileri — core audit manager migration
3. Beta plugin partial auth — slack, email
4. Env bağımlılığı — placeholder key zorunluluğu

---

## Kapsam (In Scope)

### 1. Test Envanteri ve Sınıflandırma

Her başarısız test dosyası için:

| Kategori | Aksiyon |
|----------|---------|
| **Fix** | Gerçek regresyon — kod veya test güncelle |
| **Remove** | Obsolete API, kaldırılmış feature, duplicate |
| **Skip** | Beta plugin, env-heavy integration — `@manual` etiketi |
| **Replace** | Otomatik test yerine manual checklist maddesi |

### 2. Öncelikli Düzeltme Alanları

| Alan | Dosya örnekleri | Not |
|------|-----------------|-----|
| Audit API | `tests/plugins/workspace.test.js`, secrets testleri | `auditLog` standardizasyonu |
| Core audit | `tests/core/*.test.js` | Mock helper güncelle |
| Step 2 feature smoke | Yeni minimal testler (opsiyonel, 5–10 case) | Web UI chat, MSSQL sink — yalnızca kritik path |

### 3. Kaldırılacak / Sadeleştirilecek Testler

- Duplicate contract testleri (aynı MCP schema iki dosyada)
- Startup integration testleri gerçek API key gerektiren (NOTION vb.) → manual checklist
- Plugin testleri mock olmadan full server boot eden yavaş testler → birleştir veya kaldır
- `tests/plugins/tests.test.js` gibi meta testler — değerlendir

### 4. Manuel Test Paketi (Resmi)

Step 2 tüm fazlarının manual checklist'lerini birleştiren master doküman:

`docs/roadmap/step2-manual-test-pack.md` (bu fazda oluşturulur)

İçerik:
- Faz 1–4 checklist birleşik
- Smoke script (curl komutları, secret'sız)
- Production deploy öncesi 30 dk checklist

### 5. CI Beklentisi Güncelleme

- CI'da test: geçen testler yeşil; `@manual` skip'ler raporlanır
- **%100 geçiş zorunlu değil** — hedef: anlamlı testler yeşil, obsolete kaldırılmış
- Coverage gate gevşetilmez veya kaldırılır (Step 2 kararı)

---

## Kapsam Dışı (Out of Scope)

- Yeni plugin'ler için %75 coverage hedefi
- E2E Playwright / Cursor STDIO golden test
- Property-based testing
- Performance/load test suite
- GitHub Actions tam pipeline (ayrı initiative)

---

## Görevler

| # | Görev |
|---|-------|
| 1 | `npm run test:run` çıktısını dosyala; 114 fail kategorize et |
| 2 | `auditEntry` → `auditLog` — secrets, workspace, http plugin test fix |
| 3 | Shared test helper: `createMockAuditManager()` | `tests/framework/` |
| 4 | Obsolete test dosyalarını kaldır (PR'da gerekçe listesi) |
| 5 | Beta plugin testleri `@manual` veya skip + README notu |
| 6 | Step 2 smoke: 3–5 vitest (MSSQL mock, settings encrypt unit) — opsiyonel |
| 7 | `step2-manual-test-pack.md` oluştur |
| 8 | `docs/operations.md` — test bölümü güncelle |
| 9 | `current-state.md` metrikleri güncelle |
| 10 | `technical-debt.md` — test maddesi kapat veya revize et |

---

## Kabul Kriterleri

- [ ] Başarısız test sayısı 114'ten **≤20**'ye düşürüldü (veya obsolete testler kaldırıldığı için toplam case azaldı)
- [ ] Core modül testleri (`src/core/**`) %100 geçiyor
- [ ] Audit API uyumsuzluğu kaynaklı fail **0**
- [ ] Kaldırılan her test dosyası PR açıklamasında gerekçelendirildi
- [ ] `step2-manual-test-pack.md` oluşturuldu ve Faz 1–4 checklist'lerini kapsıyor
- [ ] Manual test pack Step 2 release adayında uygulandı (kayıt altına alındı)
- [ ] Vitest yeni coverage hedefi eklenmedi (scope creep yok)

---

## Manuel Test Kontrol Listesi (Faz 5 Meta)

### Test Suite

- [ ] `cd mcp-server && npm run test:run` — sonuç raporu kaydedildi
- [ ] Core testler tam yeşil
- [ ] Skip/manual testler `vitest` raporunda görünüyor
- [ ] Kaldırılan test sayısı ve gerekçe dokümante

### Step 2 Regression (Master Pack Özeti)

- [ ] Faz 1: Web UI chat + tool loop
- [ ] Faz 2: MSSQL audit + memory_sync_state
- [ ] Faz 3: Obsidian export
- [ ] Faz 4: Settings UI + hot reload
- [ ] STDIO MCP Cursor bağlantısı
- [ ] `/admin` + `/ui` + `/mcp` HTTP

### Dokümantasyon

- [ ] `current-state.md` test metrikleri güncel
- [ ] `README.md` roadmap Step 2 linkleri doğru
- [ ] Operations.md manual test bölümü var

---

## Bağımlılıklar

| Bağımlılık | Tip |
|------------|-----|
| Faz 1–4 tamamlanmış | Hard gate |
| Step 2 feature'lar stabil | Hard |

**Sonraki adım:** [step2-future-backlog.md](./step2-future-backlog.md)

---

## Test Azaltma Prensipleri

1. **Bir davranış, bir test** — duplicate kaldır
2. **Integration > unit** yalnızca gerçek entegrasyon test ediyorsa; aksi halde manual
3. **Env-heavy test yok** — gerçek API key gerektiren otomatik test kaldır
4. **Flaky test kaldır** — 3 kez fail → fix veya remove kararı

---

## İlgili Belgeler

- [step2-master-plan.md](./step2-master-plan.md)
- [technical-debt.md](./technical-debt.md)
- [current-state.md](./current-state.md)
- [operations.md](../operations.md)
