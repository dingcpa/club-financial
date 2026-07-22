<template>
  <div>
    <!-- ── 列表 ── -->
    <v-card v-if="!selected" elevation="1">
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-gavel</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">理監事會議議程</span>
        </div>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">新增會議</v-btn>
      </v-card-title>
      <v-card-text class="pa-3 pa-sm-4 pt-0">
        <div v-if="loading" class="text-center pa-8"><v-progress-circular indeterminate color="primary" /></div>
        <div v-else-if="!meetings.length" class="text-center text-medium-emphasis pa-8">
          尚未建立會議，點「新增會議」開始安排議程。
        </div>
        <v-table v-else density="compact">
          <thead>
            <tr>
              <th class="text-caption">會議名稱</th>
              <th class="text-caption" style="width:110px">日期</th>
              <th class="text-caption" style="width:80px">時間</th>
              <th class="text-caption" style="width:160px">地點</th>
              <th class="text-caption text-center" style="width:90px">議案</th>
              <th class="text-caption text-center" style="width:90px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in meetings" :key="m.id" style="cursor:pointer" @click="openDetail(m)">
              <td class="text-caption font-weight-medium">{{ m.title }}</td>
              <td class="text-caption" style="white-space:nowrap">{{ m.meetingDate ? toMinguoDate(m.meetingDate) : '—' }}</td>
              <td class="text-caption">{{ m.meetingTime || '—' }}</td>
              <td class="text-caption">{{ m.location || '—' }}</td>
              <td class="text-center">
                <v-chip size="x-small" color="primary" variant="tonal">
                  {{ (m.agenda.proposals || []).length }} 案
                </v-chip>
              </td>
              <td class="text-center">
                <v-btn icon size="x-small" variant="text" color="error" @click.stop="handleDelete(m)">
                  <v-icon size="14">mdi-delete</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- ── 明細（議案編輯） ── -->
    <template v-else>
      <v-card elevation="1" class="mb-3">
        <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
          <div class="d-flex align-center ga-2">
            <v-btn icon size="small" variant="text" @click="selected = null"><v-icon>mdi-arrow-left</v-icon></v-btn>
            <span class="text-body-1 font-weight-bold">{{ form.title }}</span>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-printer" @click="printAgenda">列印議程</v-btn>
            <v-btn color="teal" variant="tonal" size="small" prepend-icon="mdi-file-document-multiple" @click="printFull">
              產生會議文件（含財務報表）
            </v-btn>
            <v-btn color="success" variant="flat" size="small" prepend-icon="mdi-content-save" :loading="saving" @click="handleSave">儲存</v-btn>
          </div>
        </v-card-title>
        <v-card-text class="pt-0 px-3 px-sm-4">
          <v-row dense>
            <v-col cols="12" sm="4"><v-text-field v-model="form.title" label="會議名稱" density="compact" variant="outlined" hide-details /></v-col>
            <v-col cols="6" sm="2"><v-text-field v-model="form.meetingDate" label="日期" type="date" density="compact" variant="outlined" hide-details /></v-col>
            <v-col cols="6" sm="2"><v-text-field v-model="form.meetingTime" label="時間" placeholder="18:30" density="compact" variant="outlined" hide-details /></v-col>
            <v-col cols="12" sm="4"><v-text-field v-model="form.location" label="地點" density="compact" variant="outlined" hide-details /></v-col>
          </v-row>
          <div class="text-caption text-medium-emphasis mt-2">
            會議文件之財務報表期間依會議日期自動取當月（{{ reportMonthLabel }}）；含收支月報表、資產負債表與應收/應付/預收/代收付四張附表。
          </div>
        </v-card-text>
      </v-card>

      <!-- 壹、報告事項 -->
      <v-card elevation="1" class="mb-3">
        <v-card-title class="d-flex justify-space-between align-center py-2 px-3 px-sm-4" style="border-bottom:2px solid #4f46e5">
          <span class="text-body-2 font-weight-bold">壹、報告事項</span>
          <v-btn size="x-small" variant="tonal" prepend-icon="mdi-plus" @click="form.agenda.reports.push({ text: '' })">新增報告</v-btn>
        </v-card-title>
        <v-card-text class="pa-3 pa-sm-4">
          <div v-if="!form.agenda.reports.length" class="text-caption text-medium-emphasis">尚無報告事項</div>
          <div v-for="(r, i) in form.agenda.reports" :key="i" class="d-flex ga-2 mb-2 align-start">
            <span class="text-caption text-medium-emphasis mt-2" style="min-width:32px">{{ CN_NUMS[i] || i + 1 }}、</span>
            <v-textarea v-model="r.text" density="compact" variant="outlined" rows="2" auto-grow hide-details class="flex-grow-1" />
            <v-btn icon size="x-small" variant="text" color="error" class="mt-1" @click="form.agenda.reports.splice(i, 1)">
              <v-icon size="14">mdi-delete</v-icon>
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- 貳、提案討論 -->
      <v-card elevation="1" class="mb-3">
        <v-card-title class="d-flex justify-space-between align-center py-2 px-3 px-sm-4" style="border-bottom:2px solid #4f46e5">
          <span class="text-body-2 font-weight-bold">貳、提案討論</span>
          <v-btn size="x-small" variant="tonal" prepend-icon="mdi-plus" @click="form.agenda.proposals.push({ subject: '', description: '', resolution: '' })">新增提案</v-btn>
        </v-card-title>
        <v-card-text class="pa-3 pa-sm-4">
          <div v-if="!form.agenda.proposals.length" class="text-caption text-medium-emphasis">尚無提案</div>
          <v-card v-for="(p, i) in form.agenda.proposals" :key="i" variant="outlined" class="pa-3 mb-3" rounded="lg">
            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-caption font-weight-bold text-primary">提案{{ CN_NUMS[i] || i + 1 }}</span>
              <div>
                <v-btn icon size="x-small" variant="text" :disabled="i === 0" @click="swapProposal(i, i - 1)"><v-icon size="14">mdi-arrow-up</v-icon></v-btn>
                <v-btn icon size="x-small" variant="text" :disabled="i === form.agenda.proposals.length - 1" @click="swapProposal(i, i + 1)"><v-icon size="14">mdi-arrow-down</v-icon></v-btn>
                <v-btn icon size="x-small" variant="text" color="error" @click="form.agenda.proposals.splice(i, 1)"><v-icon size="14">mdi-delete</v-icon></v-btn>
              </div>
            </div>
            <v-text-field v-model="p.subject" label="案由" density="compact" variant="outlined" class="mb-2" hide-details />
            <v-textarea v-model="p.description" label="說明（選填）" density="compact" variant="outlined" rows="2" auto-grow class="mb-2 mt-2" hide-details />
            <v-text-field v-model="p.resolution" label="決議（會後填寫）" density="compact" variant="outlined" class="mt-2" hide-details />
          </v-card>
        </v-card-text>
      </v-card>
    </template>

    <!-- 新增會議 Dialog -->
    <v-dialog v-model="createDialog" :max-width="xs ? undefined : 440" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">新增會議</span>
          <v-btn icon variant="text" @click="createDialog = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-text-field v-model="createForm.title" label="會議名稱" density="compact" variant="outlined" class="mb-2" />
          <v-row dense>
            <v-col cols="6"><v-text-field v-model="createForm.meetingDate" label="日期" type="date" density="compact" variant="outlined" @update:model-value="syncCreateTitle" /></v-col>
            <v-col cols="6"><v-text-field v-model="createForm.meetingTime" label="時間" placeholder="18:30" density="compact" variant="outlined" /></v-col>
          </v-row>
          <v-text-field v-model="createForm.location" label="地點" density="compact" variant="outlined" />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="createDialog = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="handleCreate">建立</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── 列印：議程（＋可選財務報表） ── -->
    <PrintSheet v-if="selected">
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central ・ 國際扶輪 3470 地區</div>
      <div class="print-title">{{ form.title }}</div>
      <div class="print-meta">
        時間：{{ form.meetingDate ? toMinguoDate(form.meetingDate) : '' }}{{ form.meetingTime ? `（${form.meetingTime}）` : '' }}
        　地點：{{ form.location || '（未定）' }}
      </div>

      <div class="print-section-title">壹、報告事項</div>
      <div v-if="!form.agenda.reports.length" style="font-size:11px;color:#666">（無）</div>
      <div v-for="(r, i) in form.agenda.reports" :key="'pr' + i" style="font-size:12px;margin-bottom:6px;white-space:pre-wrap">{{ CN_NUMS[i] || i + 1 }}、{{ r.text }}</div>

      <div class="print-section-title">貳、提案討論</div>
      <div v-if="!form.agenda.proposals.length" style="font-size:11px;color:#666">（無）</div>
      <div v-for="(p, i) in form.agenda.proposals" :key="'pp' + i" style="font-size:12px;margin-bottom:10px">
        <div><b>提案{{ CN_NUMS[i] || i + 1 }}、案由：</b>{{ p.subject }}</div>
        <div v-if="p.description" style="white-space:pre-wrap;margin-left:16px"><b>說明：</b>{{ p.description }}</div>
        <div style="margin-left:16px"><b>決議：</b>{{ p.resolution || '　　　　　　　　　　　　' }}</div>
      </div>

      <div class="print-section-title">參、臨時動議</div>
      <div style="font-size:12px;margin-bottom:8px">　</div>
      <div class="print-sign"><span>主席：＿＿＿＿＿＿＿＿</span><span>記錄：＿＿＿＿＿＿＿＿</span></div>

      <!-- 財務報表（一鍵產生會議文件） -->
      <template v-if="printMode === 'full'">
        <!-- 收支月報表 -->
        <div style="page-break-before:always">
          <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
          <div class="print-title">收支月報表</div>
          <div class="print-meta">報表期間　{{ reportMonthLabel }}　・　幣別：新臺幣 NT$　・　認列基礎：權責發生制</div>
          <div class="print-cols">
            <div>
              <div class="print-section-title">收入明細</div>
              <table>
                <thead><tr><th>科目</th><th class="num" style="width:110px">月計</th></tr></thead>
                <tbody>
                  <tr v-for="r in monthlyPL.income" :key="r.code"><td>{{ r.name }}</td><td class="num">{{ fmt(r.amount) }}</td></tr>
                  <tr class="total"><td>收入合計</td><td class="num">{{ fmt(monthlyPL.totalIncome) }}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div class="print-section-title">支出明細</div>
              <table>
                <thead><tr><th>科目</th><th class="num" style="width:110px">月計</th></tr></thead>
                <tbody>
                  <tr v-for="r in monthlyPL.expense" :key="r.code"><td>{{ r.name }}</td><td class="num">{{ fmt(r.amount) }}</td></tr>
                  <tr class="total"><td>支出合計</td><td class="num">{{ fmt(monthlyPL.totalExpense) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="print-cards">
            <div class="print-card" style="border-left-color:#15803d">
              <div class="label">■ 本月合計收入</div>
              <div class="amount" style="color:#15803d">NT$ {{ fmt(monthlyPL.totalIncome) }}</div>
            </div>
            <div class="print-card" style="border-left-color:#b91c1c">
              <div class="label">■ 本月合計支出</div>
              <div class="amount" style="color:#b91c1c">NT$ {{ fmt(monthlyPL.totalExpense) }}</div>
            </div>
            <div class="print-card" style="border-left-color:#1d4ed8">
              <div class="label">■ 本月收支餘額</div>
              <div class="amount" :style="`color:${monthlyPL.net >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(monthlyPL.net) }}</div>
            </div>
          </div>
          <div class="print-cards">
            <div class="print-card" style="border-left-color:#1d4ed8">
              <div class="label">本月結餘</div>
              <div class="amount" :style="`color:${monthlyPL.net >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(monthlyPL.net) }}</div>
            </div>
            <div class="print-card" style="border-left-color:#1d4ed8">
              <div class="label">＋ 上期結餘（本期期初權益）</div>
              <div class="amount" :style="`color:${monthlyPL.prevCumNet >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(monthlyPL.prevCumNet) }}</div>
            </div>
            <div class="print-card" style="border-left-color:#1d4ed8">
              <div class="label">＝ 累計結餘（＝BS 累積餘絀＋本期餘絀）</div>
              <div class="amount" :style="`color:${monthlyPL.cumNet >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(monthlyPL.cumNet) }}</div>
            </div>
          </div>
        </div>

        <!-- 資產負債表 -->
        <div style="page-break-before:always">
          <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
          <div class="print-title">資產負債表</div>
          <div class="print-meta">基準日 {{ toMinguoDate(asOf) }}　・　幣別：新臺幣 NT$</div>
          <div class="print-cols">
            <div>
              <div class="print-section-title">資產</div>
              <table>
                <tbody>
                  <tr v-for="r in bs.assets" :key="r.code"><td>{{ r.name }}</td><td class="num" style="width:110px">{{ fmt(r.amount) }}</td></tr>
                  <tr class="total"><td>資產合計</td><td class="num">{{ fmt(bs.totalAssets) }}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div class="print-section-title">負債</div>
              <table>
                <tbody>
                  <tr v-for="r in bs.liabilities" :key="r.code"><td>{{ r.name }}</td><td class="num" style="width:110px">{{ fmt(r.amount) }}</td></tr>
                  <tr v-if="!bs.liabilities.length"><td colspan="2">（無負債）</td></tr>
                  <tr class="total"><td>負債合計</td><td class="num">{{ fmt(bs.totalLiabilities) }}</td></tr>
                </tbody>
              </table>
              <div class="print-section-title">權益</div>
              <table>
                <tbody>
                  <tr v-for="r in bs.equity" :key="r.code"><td>{{ r.name }}</td><td class="num" style="width:110px">{{ fmt(r.amount) }}</td></tr>
                  <tr class="total"><td>權益合計</td><td class="num">{{ fmt(bs.totalEquity) }}</td></tr>
                  <tr class="total"><td>負債及權益合計</td><td class="num">{{ fmt(bs.totalLiabilities + bs.totalEquity) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 附表一：帳款明細統計 -->
        <div style="page-break-before:always">
          <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
          <div class="print-title">附表一　應收明細表（項目統計）</div>
          <div class="print-meta">民國 {{ reportYearMinguo }} 年度　・　幣別：新臺幣 NT$</div>
          <table>
            <thead>
              <tr><th>性質 / 項目</th><th class="num" style="width:56px">筆數</th><th class="num" style="width:96px">應收</th><th class="num" style="width:96px">已收</th><th class="num" style="width:96px">未收</th><th class="num" style="width:86px">免繳</th></tr>
            </thead>
            <tbody>
              <template v-for="g in arStats.groups" :key="g.nature">
                <tr class="group"><td>{{ g.nature }}</td><td class="num">{{ g.count }}</td><td class="num">{{ fmt(g.target) }}</td><td class="num">{{ fmt(g.paid) }}</td><td class="num">{{ fmt(g.unpaid) }}</td><td class="num">{{ g.waived ? fmt(g.waived) : '—' }}</td></tr>
                <tr v-for="it in g.items" :key="it.item"><td style="padding-left:22px">{{ it.item }}</td><td class="num">{{ it.count }}</td><td class="num">{{ fmt(it.target) }}</td><td class="num">{{ fmt(it.paid) }}</td><td class="num">{{ fmt(it.unpaid) }}</td><td class="num">{{ it.waived ? fmt(it.waived) : '—' }}</td></tr>
              </template>
              <tr class="total"><td>合計</td><td class="num">{{ arStats.total.count }}</td><td class="num">{{ fmt(arStats.total.target) }}</td><td class="num">{{ fmt(arStats.total.paid) }}</td><td class="num">{{ fmt(arStats.total.unpaid) }}</td><td class="num">{{ arStats.total.waived ? fmt(arStats.total.waived) : '—' }}</td></tr>
            </tbody>
          </table>
          <div class="print-footer">負數項目為補助抵減（借費用／貸應收）。</div>
        </div>

        <!-- 附表二：應付明細統計 -->
        <div style="page-break-before:always">
          <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
          <div class="print-title">附表二　應付明細表（項目統計）</div>
          <div class="print-meta">民國 {{ reportYearMinguo }} 年度　・　幣別：新臺幣 NT$</div>
          <table>
            <thead>
              <tr><th>科目 / 項目</th><th style="width:100px">對象</th><th class="num" style="width:52px">筆數</th><th class="num" style="width:92px">應付</th><th class="num" style="width:92px">已付</th><th class="num" style="width:92px">未付</th><th class="num" style="width:82px">免付</th></tr>
            </thead>
            <tbody>
              <template v-for="g in apStats.groups" :key="g.code">
                <tr class="group"><td colspan="2">{{ g.label }}</td><td class="num">{{ g.count }}</td><td class="num">{{ fmt(g.target) }}</td><td class="num">{{ fmt(g.paid) }}</td><td class="num">{{ fmt(g.unpaid) }}</td><td class="num">{{ g.waived ? fmt(g.waived) : '—' }}</td></tr>
                <tr v-for="it in g.items" :key="it.key"><td style="padding-left:22px">{{ it.item }}</td><td>{{ it.payee }}</td><td class="num">{{ it.count }}</td><td class="num">{{ fmt(it.target) }}</td><td class="num">{{ fmt(it.paid) }}</td><td class="num">{{ fmt(it.unpaid) }}</td><td class="num">{{ it.waived ? fmt(it.waived) : '—' }}</td></tr>
              </template>
              <tr v-if="!apStats.groups.length"><td colspan="7">（本年度無應付帳款）</td></tr>
              <tr class="total"><td colspan="2">合計</td><td class="num">{{ apStats.total.count }}</td><td class="num">{{ fmt(apStats.total.target) }}</td><td class="num">{{ fmt(apStats.total.paid) }}</td><td class="num">{{ fmt(apStats.total.unpaid) }}</td><td class="num">{{ apStats.total.waived ? fmt(apStats.total.waived) : '—' }}</td></tr>
            </tbody>
          </table>
          <div class="print-footer">應付立帳＝費用認列日（借費用或代收款轉繳／貸 2112 應付帳款）；付款單沖帳不再認列費用。</div>
        </div>

        <!-- 附表三：預收明細 -->
        <div style="page-break-before:always">
          <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
          <div class="print-title">附表三　預收明細表</div>
          <div class="print-meta">基準日 {{ toMinguoDate(asOf) }}　・　期初預收＋本期新增－本期轉列收入＝期末餘額</div>
          <template v-for="sec in prepaidSections" :key="sec.code">
            <div class="print-section-title">{{ sec.code }} {{ sec.name }}</div>
            <table>
              <thead><tr><th>對象</th><th class="num" style="width:96px">期初預收</th><th class="num" style="width:96px">本期新增</th><th class="num" style="width:106px">本期轉列收入</th><th class="num" style="width:106px">期末餘額</th></tr></thead>
              <tbody>
                <tr v-for="g in sec.rows" :key="g.person"><td>{{ g.person }}</td><td class="num">{{ fmt(g.opening) }}</td><td class="num">{{ fmt(g.added) }}</td><td class="num">{{ fmt(g.recognized) }}</td><td class="num">{{ fmt(g.closing) }}</td></tr>
                <tr class="total"><td>合計</td><td class="num">{{ fmt(sec.totals.opening) }}</td><td class="num">{{ fmt(sec.totals.added) }}</td><td class="num">{{ fmt(sec.totals.recognized) }}</td><td class="num">{{ fmt(sec.totals.closing) }}</td></tr>
              </tbody>
            </table>
          </template>
        </div>

        <!-- 附表四：代收付明細 -->
        <div style="page-break-before:always">
          <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
          <div class="print-title">附表四　代收付明細表</div>
          <div class="print-meta">基準日 {{ toMinguoDate(asOf) }}　・　代收款（2111）按案名彙總</div>
          <table>
            <thead><tr><th>案名 / 對象</th><th class="num" style="width:120px">開單/收現（貸）</th><th class="num" style="width:120px">付出（借）</th><th class="num" style="width:120px">餘額</th></tr></thead>
            <tbody>
              <tr v-for="g in agencyLedger.rows" :key="g.person"><td>{{ g.person }}</td><td class="num">{{ fmt(g.credit) }}</td><td class="num">{{ fmt(g.debit) }}</td><td class="num">{{ fmt(g.balance) }}</td></tr>
              <tr class="total"><td>合計（＝資產負債表代收款餘額）</td><td class="num">{{ fmt(agencyLedger.credit) }}</td><td class="num">{{ fmt(agencyLedger.debit) }}</td><td class="num">{{ fmt(agencyLedger.balance) }}</td></tr>
            </tbody>
          </table>
          <div class="print-footer">代收款屬負債科目，不計入收支餘絀。</div>
        </div>
      </template>
    </PrintSheet>
  </div>
</template>

<script setup>
import { ref, computed, inject, nextTick } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { apiFetch } from '../composables/apiFetch.js'
import { fyOf, fyRange, monthEnd, toMinguoDate, toMinguoYear } from '../accounting/fiscal.js'
import { balanceSheet } from '../accounting/ledger.js'
import { CODES } from '../accounting/coa.js'
import PrintSheet from '../components/PrintSheet.vue'

const { xs } = useDisplay()
const accounting = inject('accounting')
const receivables = inject('receivables')
const payables = inject('payables', null)
const accounts = inject('accounts')

const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五']

const meetings = ref([])
const loading = ref(true)
const saving = ref(false)
const selected = ref(null)
const form = ref(makeForm())
const printMode = ref('agenda')

function makeForm() {
  return { title: '', meetingDate: '', meetingTime: '', location: '', agenda: { reports: [], proposals: [] } }
}

async function fetchMeetings() {
  loading.value = true
  try {
    const res = await apiFetch('/api/meetings')
    meetings.value = await res.json()
  } finally {
    loading.value = false
  }
}
fetchMeetings()

// ── 新增 ──
const createDialog = ref(false)
const createForm = ref({ title: '', meetingDate: '', meetingTime: '18:30', location: '' })

function defaultTitle(date) {
  if (!date) return '理監事會議'
  const [y, m] = date.split('-').map(Number)
  return `${toMinguoYear(y)}年${m}月份理監事會議`
}
function syncCreateTitle(date) {
  if (!createForm.value.title || /^\d+年\d+月份理監事會議$/.test(createForm.value.title)) {
    createForm.value.title = defaultTitle(date)
  }
}
function openCreate() {
  const today = new Date().toISOString().split('T')[0]
  createForm.value = { title: defaultTitle(today), meetingDate: today, meetingTime: '18:30', location: '' }
  createDialog.value = true
}
async function handleCreate() {
  if (!createForm.value.title) return
  saving.value = true
  try {
    const res = await apiFetch('/api/meetings', { method: 'POST', body: JSON.stringify(createForm.value) })
    const saved = await res.json()
    if (!res.ok) throw new Error(saved.error || '建立失敗')
    createDialog.value = false
    await fetchMeetings()
    openDetail(meetings.value.find(m => m.id === saved.id) || saved)
  } catch (e) {
    Swal.fire({ icon: 'error', title: '建立失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 明細 ──
function openDetail(m) {
  selected.value = m
  form.value = {
    title: m.title,
    meetingDate: m.meetingDate || '',
    meetingTime: m.meetingTime || '',
    location: m.location || '',
    agenda: {
      reports: (m.agenda.reports || []).map(r => ({ text: typeof r === 'string' ? r : (r.text || '') })),
      proposals: (m.agenda.proposals || []).map(p => ({ subject: p.subject || '', description: p.description || '', resolution: p.resolution || '' })),
    },
  }
}

function swapProposal(i, j) {
  const arr = form.value.agenda.proposals
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

async function handleSave() {
  saving.value = true
  try {
    const res = await apiFetch(`/api/meetings/${selected.value.id}`, { method: 'PUT', body: JSON.stringify(form.value) })
    const saved = await res.json()
    if (!res.ok) throw new Error(saved.error || '儲存失敗')
    await fetchMeetings()
    selected.value = meetings.value.find(m => m.id === saved.id) || saved
    Swal.fire({ icon: 'success', title: '議程已儲存', timer: 1200, showConfirmButton: false })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

async function handleDelete(m) {
  const result = await Swal.fire({
    title: '刪除會議？', text: `「${m.title}」與其議案內容將刪除。`, icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '刪除', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await apiFetch(`/api/meetings/${m.id}`, { method: 'DELETE' })
  await fetchMeetings()
}

// ── 列印 ──
function printAgenda() { printMode.value = 'agenda'; nextTick(() => window.print()) }
function printFull() { printMode.value = 'full'; nextTick(() => window.print()) }

// ── 財務報表（期間依會議日期當月） ──
const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const r2 = (n) => Math.round(n * 100) / 100

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

const reportYm = computed(() => (form.value.meetingDate || new Date().toISOString().slice(0, 10)).slice(0, 7))
const asOf = computed(() => monthEnd(reportYm.value))
const reportFy = computed(() => fyOf(`${reportYm.value}-01`))
const reportMonthLabel = computed(() => {
  const [y, m] = reportYm.value.split('-').map(Number)
  return `民國 ${toMinguoYear(y)} 年 ${m} 月`
})
const reportYearMinguo = computed(() => toMinguoYear(reportYm.value.slice(0, 4)))

// 收支月報表（科目別）
const monthlyPL = computed(() => {
  const from = `${reportYm.value}-01`
  const inc = new Map(), exp = new Map()
  // 上期結餘＝本期期初權益（期初累積餘絀＋基準日後至上月底之累計損益）
  let prevCumNet = 0
  for (const e of entries.value) {
    if (e.sourceType === 'closing') continue
    for (const l of e.lines) {
      const a = acctByCode.value[l.accountCode]
      if (!a) continue
      if (a.type === 'equity') {
        if (e.date < from) prevCumNet += (l.credit || 0) - (l.debit || 0)
        continue
      }
      if (a.type !== 'income' && a.type !== 'expense') continue
      const signed = a.type === 'income' ? (l.credit || 0) - (l.debit || 0) : (l.debit || 0) - (l.credit || 0)
      if (e.date >= from && e.date <= asOf.value) {
        const m = a.type === 'income' ? inc : exp
        m.set(l.accountCode, r2((m.get(l.accountCode) || 0) + signed))
      } else if (e.date < from) {
        prevCumNet += a.type === 'income' ? signed : -signed
      }
    }
  }
  const toRows = (m) => [...m].filter(([, v]) => v).sort()
    .map(([code, amount]) => ({ code, name: `${code} ${acctByCode.value[code]?.name || ''}`, amount }))
  const income = toRows(inc), expense = toRows(exp)
  const totalIncome = r2(income.reduce((s, x) => s + x.amount, 0))
  const totalExpense = r2(expense.reduce((s, x) => s + x.amount, 0))
  const net = r2(totalIncome - totalExpense)
  prevCumNet = r2(prevCumNet)
  return { income, expense, totalIncome, totalExpense, net, prevCumNet, cumNet: r2(net + prevCumNet) }
})

// 資產負債表
const bs = computed(() => balanceSheet(entries.value, acctByCode.value, { asOf: asOf.value }))

// 附表一：帳款統計（會議年度）
function paidOf(r) {
  if (r.status === 'paid') return r.paidAmount != null ? r.paidAmount : r.amount
  if (r.status === 'partial') return r.paidAmount || 0
  return 0
}
function natureOf(r) {
  if (r.sourceType === 'agency' || r.accountCode === CODES.AGENCY) return '代收'
  if (r.accountCode === '4101' || r.accountCode === '4106') return '社費'
  if (r.accountCode === '4102') return '紅箱'
  if ((r.accountCode || '').startsWith('5')) return '補助'
  if (r.accountCode === CODES.TEMP_RECEIPT) return '暫收'
  return '其他'
}
const arStats = computed(() => {
  const year = reportYm.value.slice(0, 4)
  const natureOrder = ['社費', '紅箱', '代收', '補助', '暫收', '其他']
  const byNature = new Map()
  for (const r of receivables?.value || []) {
    if (String(r.dueYear) !== year) continue
    const n = natureOf(r)
    if (!byNature.has(n)) byNature.set(n, new Map())
    const items = byNature.get(n)
    if (!items.has(r.sourceRef)) items.set(r.sourceRef, { item: r.sourceRef, count: 0, target: 0, paid: 0, waived: 0 })
    const g = items.get(r.sourceRef)
    g.count++
    if (r.status === 'waived') g.waived += r.amount
    else { g.target += r.amount; g.paid += paidOf(r) }
  }
  const groups = natureOrder.filter(n => byNature.has(n)).map(n => {
    const items = [...byNature.get(n).values()]
      .map(g => ({ ...g, target: r2(g.target), paid: r2(g.paid), waived: r2(g.waived), unpaid: r2(g.target - g.paid) }))
      .sort((a, b) => a.item.localeCompare(b.item, 'zh-Hant'))
    const sum = (f) => r2(items.reduce((s, g) => s + g[f], 0))
    return { nature: n, items, count: items.reduce((s, g) => s + g.count, 0), target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived') }
  })
  const total = {
    count: groups.reduce((s, g) => s + g.count, 0),
    target: r2(groups.reduce((s, g) => s + g.target, 0)),
    paid: r2(groups.reduce((s, g) => s + g.paid, 0)),
    unpaid: r2(groups.reduce((s, g) => s + g.unpaid, 0)),
    waived: r2(groups.reduce((s, g) => s + g.waived, 0)),
  }
  return { groups, total }
})

// 附表二：應付統計（會議年度；科目 → 項目×對象）
const apStats = computed(() => {
  const year = reportYm.value.slice(0, 4)
  const acctLabel = (code) => {
    const a = (accounts?.value || []).find(x => x.code === code)
    return a ? `${a.code} ${a.name}` : (code || '—')
  }
  const paidOfP = (p) => {
    if (p.status === 'paid') return p.paidAmount != null ? p.paidAmount : p.amount
    if (p.status === 'partial') return p.paidAmount || 0
    return 0
  }
  const byCode = new Map()
  for (const p of payables?.value || []) {
    if (String(p.dueYear) !== year) continue
    const code = p.accountCode || '—'
    if (!byCode.has(code)) byCode.set(code, new Map())
    const items = byCode.get(code)
    const key = `${p.sourceRef}|${p.payee}`
    if (!items.has(key)) items.set(key, { key, item: p.sourceRef, payee: p.payee, count: 0, target: 0, paid: 0, waived: 0 })
    const g = items.get(key)
    g.count++
    if (p.status === 'waived') g.waived += p.amount
    else { g.target += p.amount; g.paid += paidOfP(p) }
  }
  const groups = [...byCode.keys()].sort().map(code => {
    const items = [...byCode.get(code).values()]
      .map(g => ({ ...g, target: r2(g.target), paid: r2(g.paid), waived: r2(g.waived), unpaid: r2(g.target - g.paid) }))
      .sort((a, b) => a.item.localeCompare(b.item, 'zh-Hant') || a.payee.localeCompare(b.payee, 'zh-Hant'))
    const sum = (f) => r2(items.reduce((s, g) => s + g[f], 0))
    return { code, label: acctLabel(code), items, count: items.reduce((s, g) => s + g.count, 0), target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived') }
  })
  const total = {
    count: groups.reduce((s, g) => s + g.count, 0),
    target: r2(groups.reduce((s, g) => s + g.target, 0)),
    paid: r2(groups.reduce((s, g) => s + g.paid, 0)),
    unpaid: r2(groups.reduce((s, g) => s + g.unpaid, 0)),
    waived: r2(groups.reduce((s, g) => s + g.waived, 0)),
  }
  return { groups, total }
})

// 附表三：預收明細（年度 7/1 起至基準日）
function buildPrepaidSection(code) {
  const [fyStart] = fyRange(reportFy.value)
  const map = new Map()
  for (const e of entries.value) {
    if (e.sourceType === 'closing' || e.date > asOf.value) continue
    for (const l of e.lines) {
      if (l.accountCode !== code) continue
      const person = l.person || '未指定'
      if (!map.has(person)) map.set(person, { person, opening: 0, added: 0, recognized: 0 })
      const g = map.get(person)
      if (e.date < fyStart) g.opening += (l.credit || 0) - (l.debit || 0)
      else { g.added += l.credit || 0; g.recognized += l.debit || 0 }
    }
  }
  const rows = [...map.values()]
    .map(g => ({ ...g, opening: r2(g.opening), added: r2(g.added), recognized: r2(g.recognized), closing: r2(g.opening + g.added - g.recognized) }))
    .filter(g => g.opening || g.added || g.recognized)
    .sort((a, b) => a.person.localeCompare(b.person, 'zh-Hant'))
  const totals = {
    opening: r2(rows.reduce((s, g) => s + g.opening, 0)),
    added: r2(rows.reduce((s, g) => s + g.added, 0)),
    recognized: r2(rows.reduce((s, g) => s + g.recognized, 0)),
    closing: r2(rows.reduce((s, g) => s + g.closing, 0)),
  }
  return { code, name: acctByCode.value[code]?.name || code, rows, totals }
}
const prepaidSections = computed(() =>
  [buildPrepaidSection(CODES.UNEARNED_DUES), buildPrepaidSection(CODES.UNEARNED_OTHER)].filter(s => s.rows.length))

// 附表三：代收款總勾稽（至基準日）
const agencyLedger = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    if (e.sourceType === 'closing' || e.date > asOf.value) continue
    for (const l of e.lines) {
      if (l.accountCode !== CODES.AGENCY) continue
      const person = l.person || '未指定'
      if (!map.has(person)) map.set(person, { person, credit: 0, debit: 0 })
      const g = map.get(person)
      g.credit += l.credit || 0
      g.debit += l.debit || 0
    }
  }
  const rows = [...map.values()]
    .map(g => ({ ...g, credit: r2(g.credit), debit: r2(g.debit), balance: r2(g.credit - g.debit) }))
    .sort((a, b) => (Math.abs(b.balance) - Math.abs(a.balance)) || a.person.localeCompare(b.person, 'zh-Hant'))
  return {
    rows,
    credit: r2(rows.reduce((s, g) => s + g.credit, 0)),
    debit: r2(rows.reduce((s, g) => s + g.debit, 0)),
    balance: r2(rows.reduce((s, g) => s + g.balance, 0)),
  }
})
</script>
