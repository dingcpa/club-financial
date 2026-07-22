<template>
  <div>
    <div v-if="recLoading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <!-- 標題列 -->
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-file-document-check</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">{{ toMinguoYear(selectedYear) }}年度 帳款明細表</span>
        </div>
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-printer" size="small" @click="printReport">產生附表</v-btn>
          <v-btn color="success" prepend-icon="mdi-bank-transfer-in" size="small" @click="openMatchModal">收款對帳</v-btn>
          <v-btn color="primary" prepend-icon="mdi-playlist-plus" size="small" @click="openBatchModal">批次產生帳款</v-btn>
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" size="small" @click="openCreateModal">單筆新增</v-btn>
          <v-select
            v-model="selectedYear"
            :items="availableYears"
            :item-title="y => toMinguoYear(y) + ' 年度'"
            :item-value="y => y"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:110px"
          />
        </div>
      </v-card-title>

      <!-- 年度總計摘要 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <v-row dense>
          <v-col cols="3">
            <v-card color="primary" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">總應收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-primary">NT$ {{ yearSummary.totalTarget.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">已收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-success">NT$ {{ yearSummary.totalPaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">未收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-error">NT$ {{ yearSummary.totalUnpaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="grey" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">免繳</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-grey">NT$ {{ yearSummary.totalWaived.toLocaleString() }}</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- 明細↔總帳勾稽 -->
      <div class="px-3 px-sm-4 pb-2">
        <v-chip
          size="small" variant="tonal"
          :color="arTieOut.matched ? 'success' : 'error'"
          :prepend-icon="arTieOut.matched ? 'mdi-check-circle' : 'mdi-alert-circle'"
        >
          應收明細未收合計 {{ arTieOut.detailTotal.toLocaleString() }} {{ arTieOut.matched ? '＝' : '≠' }} 帳上應收帳款餘額 {{ arTieOut.ledgerTotal.toLocaleString() }}
        </v-chip>
        <div v-if="!arTieOut.matched" class="text-caption text-error mt-1">
          差額 {{ (arTieOut.detailTotal - arTieOut.ledgerTotal).toLocaleString() }}：可能為基準日前歷史帳款（應於期初餘額表達）或分錄診斷異常，請至「帳簿查詢」檢查。
        </div>
      </div>

      <!-- 逐欄篩選列 -->
      <div class="px-3 px-sm-4 pb-2">
        <v-row dense>
          <v-col cols="6" sm="2">
            <v-select v-model="filterPeriod" label="帳期" :items="periodOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="6" sm="2">
            <v-select v-model="filterNature" label="性質" :items="natureOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="6" sm="3">
            <v-select v-model="filterItem" label="項目" :items="itemOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="6" sm="2">
            <v-autocomplete v-model="filterMember" label="對象" :items="targetOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="12" sm="3" class="d-flex align-center">
            <v-btn-toggle v-model="filterStatus" density="compact" variant="outlined" divided>
              <v-btn value="all" size="small">全部</v-btn>
              <v-btn value="unpaid" size="small" color="error">未收</v-btn>
              <v-btn value="paid" size="small" color="success">已收</v-btn>
              <v-btn value="waived" size="small" color="grey">免繳</v-btn>
            </v-btn-toggle>
          </v-col>
        </v-row>
      </div>

      <!-- 應收明細平表 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <div v-if="tableRows.length === 0" class="text-center text-medium-emphasis pa-8">
          無符合條件的應收帳款
        </div>
        <div v-else style="overflow-x:auto">
          <v-table density="compact" class="rounded" style="border:1px solid #e2e8f0;min-width:860px">
            <thead>
              <tr>
                <th style="width:70px">帳期</th>
                <th style="width:70px">性質</th>
                <th>項目</th>
                <th style="width:110px">對象</th>
                <th class="text-right" style="width:90px">應收</th>
                <th class="text-right" style="width:90px">已收</th>
                <th class="text-right" style="width:90px">未收</th>
                <th class="text-center" style="width:56px">狀態</th>
                <th class="text-center" style="width:160px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedRows" :key="item.id" :class="item.status === 'waived' ? 'text-grey' : ''">
                <td class="text-caption text-medium-emphasis">{{ periodOf(item) }}</td>
                <td>
                  <v-chip size="x-small" variant="tonal" :color="natureColor(natureOf(item))">{{ natureOf(item) }}</v-chip>
                </td>
                <td class="text-caption">{{ item.sourceRef }}</td>
                <td class="text-caption font-weight-medium">{{ item.memberName }}</td>
                <td class="text-right text-caption">{{ item.amount.toLocaleString() }}</td>
                <td class="text-right text-caption" :class="paidOf(item) !== 0 ? 'text-success font-weight-bold' : 'text-medium-emphasis'">
                  {{ paidOf(item) !== 0 ? paidOf(item).toLocaleString() : '—' }}
                </td>
                <td class="text-right text-caption" :class="remainingOf(item) !== 0 ? 'text-error font-weight-bold' : 'text-medium-emphasis'">
                  {{ item.status === 'waived' ? '—' : remainingOf(item).toLocaleString() }}
                </td>
                <td class="text-center">
                  <v-icon v-if="item.status === 'paid'" size="16" color="success" title="已收">mdi-check-circle</v-icon>
                  <v-icon v-else-if="item.status === 'partial'" size="16" color="warning" title="部分收款">mdi-circle-half-full</v-icon>
                  <v-icon v-else-if="item.status === 'waived'" size="16" color="grey" title="免繳">mdi-cancel</v-icon>
                  <v-icon v-else size="16" color="grey-lighten-1" title="未收">mdi-clock-outline</v-icon>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center ga-1">
                    <v-btn
                      v-if="item.status === 'pending' || item.status === 'partial'"
                      size="x-small" variant="tonal" color="success"
                      prepend-icon="mdi-cash-plus"
                      @click.stop="openCollectModal(item)"
                    >收款</v-btn>
                    <v-btn
                      v-if="paidOf(item) === 0 && item.status !== 'waived'"
                      size="x-small" variant="text" icon="mdi-pencil" color="primary"
                      title="編輯" @click.stop="openEditModal(item)"
                    />
                    <v-btn
                      v-if="item.status === 'pending'"
                      size="x-small" variant="text" icon="mdi-cancel" color="grey"
                      title="免繳" @click.stop="handleWaive(item)"
                    />
                    <v-btn
                      v-if="item.status === 'waived' || item.status === 'paid' || item.status === 'partial'"
                      size="x-small" variant="text" icon="mdi-restore" color="primary"
                      title="恢復為未收" @click.stop="handleReopen(item)"
                    />
                    <v-btn
                      v-if="paidOf(item) === 0"
                      size="x-small" variant="text" icon="mdi-delete" color="error"
                      title="刪除" @click.stop="handleDelete(item)"
                    />
                  </div>
                </td>
              </tr>
              <!-- 篩選結果合計 -->
              <tr style="background:#f8fafc">
                <td colspan="4" class="text-caption font-weight-bold text-right">篩選合計（{{ tableRows.length }} 筆）</td>
                <td class="text-right text-caption font-weight-bold">{{ tableTotals.amount.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold text-success">{{ tableTotals.paid.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold text-error">{{ tableTotals.remaining.toLocaleString() }}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <div v-if="tablePages > 1" class="d-flex justify-space-between align-center px-1 py-2">
          <v-btn icon size="x-small" variant="text" :disabled="tablePage <= 1" @click="tablePage--"><v-icon>mdi-chevron-left</v-icon></v-btn>
          <span class="text-caption text-medium-emphasis">{{ tablePage }} / {{ tablePages }}（{{ tableRows.length }} 筆）</span>
          <v-btn icon size="x-small" variant="text" :disabled="tablePage >= tablePages" @click="tablePage++"><v-icon>mdi-chevron-right</v-icon></v-btn>
        </div>
      </div>
    </v-card>

    <!-- 列印附表：項目統計視角 -->
    <PrintSheet>
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
      <div class="print-title">帳款明細表（項目統計）</div>
      <div class="print-meta">民國 {{ toMinguoYear(selectedYear) }} 年度　・　製表日 {{ toMinguoDate(todayStr()) }}　・　幣別：新臺幣 NT$</div>
      <table>
        <thead>
          <tr>
            <th>性質 / 項目</th>
            <th class="num" style="width:60px">筆數</th>
            <th class="num" style="width:100px">應收</th>
            <th class="num" style="width:100px">已收</th>
            <th class="num" style="width:100px">未收</th>
            <th class="num" style="width:90px">免繳</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in printStats" :key="g.nature">
            <tr class="group">
              <td>{{ g.nature }}</td>
              <td class="num">{{ g.count }}</td>
              <td class="num">{{ g.target.toLocaleString() }}</td>
              <td class="num">{{ g.paid.toLocaleString() }}</td>
              <td class="num">{{ g.unpaid.toLocaleString() }}</td>
              <td class="num">{{ g.waived ? g.waived.toLocaleString() : '—' }}</td>
            </tr>
            <tr v-for="it in g.items" :key="it.item">
              <td style="padding-left:22px">{{ it.item }}</td>
              <td class="num">{{ it.count }}</td>
              <td class="num">{{ it.target.toLocaleString() }}</td>
              <td class="num">{{ it.paid.toLocaleString() }}</td>
              <td class="num">{{ it.unpaid.toLocaleString() }}</td>
              <td class="num">{{ it.waived ? it.waived.toLocaleString() : '—' }}</td>
            </tr>
          </template>
          <tr class="total">
            <td>合計</td>
            <td class="num">{{ printGrand.count }}</td>
            <td class="num">{{ printGrand.target.toLocaleString() }}</td>
            <td class="num">{{ printGrand.paid.toLocaleString() }}</td>
            <td class="num">{{ printGrand.unpaid.toLocaleString() }}</td>
            <td class="num">{{ printGrand.waived ? printGrand.waived.toLocaleString() : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="print-footer">
        負數項目為補助抵減（借費用／貸應收）。應收明細未收合計與帳上應收帳款（1111）餘額勾稽：
        {{ arTieOut.matched ? '一致' : '不一致' }}（明細 {{ arTieOut.detailTotal.toLocaleString() }}／總帳 {{ arTieOut.ledgerTotal.toLocaleString() }}）。
      </div>
      <div class="print-sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>
    </PrintSheet>

    <!-- 批次產生帳款 Dialog -->
    <v-dialog v-model="batchModal" :max-width="xs ? undefined : 560" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">批次產生帳款</span>
          <v-btn icon variant="text" @click="batchModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <!-- 季度社費快速開單 -->
          <v-card variant="tonal" color="primary" class="pa-3 mb-3" rounded="lg">
            <div class="text-caption font-weight-bold mb-2">季度社費快速開單（每月 {{ monthlyDues.toLocaleString() }} × 3）</div>
            <v-row dense>
              <v-col cols="6">
                <v-select
                  v-model="quickFy" label="扶輪年度" :items="quickFyOptions"
                  density="compact" variant="outlined" hide-details
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="quickQuarter" label="季別" :items="quarterOptions"
                  density="compact" variant="outlined" hide-details
                  @update:model-value="applyQuickDues"
                />
              </v-col>
            </v-row>
          </v-card>

          <v-combobox
            v-model="batchForm.category"
            label="帳款類別"
            :items="categoryOptions"
            density="compact" variant="outlined" class="mb-2"
            @update:model-value="onBatchCategoryChange"
          />
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="batchForm.amount" label="金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="batchForm.dueDate" label="應收日期" type="date" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select
            v-model="batchForm.accountCode"
            label="入帳科目"
            :items="receivableAcctOptions"
            density="compact" variant="outlined" class="mb-1"
          />
          <div v-if="batchPeriodLabel" class="text-caption text-medium-emphasis mb-2">
            權責認列區間 <strong>{{ batchPeriodLabel }}</strong>：未到期部分列預收社費，逐月自動轉列收入。
          </div>

          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption font-weight-bold">選擇社友（{{ batchForm.members.length }} / {{ memberNames.length }}）</span>
            <div>
              <v-btn size="x-small" variant="text" @click="selectAllMembers">全選</v-btn>
              <v-btn size="x-small" variant="text" @click="batchForm.members = []">全不選</v-btn>
            </div>
          </div>
          <v-card variant="outlined" class="pa-2" style="max-height:240px;overflow-y:auto">
            <v-row dense>
              <v-col v-for="name in memberNames" :key="name" cols="6" sm="4">
                <v-checkbox-btn v-model="batchForm.members" :value="name" :label="name" density="compact" />
              </v-col>
            </v-row>
            <div v-if="memberNames.length === 0" class="text-caption text-medium-emphasis pa-2">尚無社友資料</div>
          </v-card>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="batchModal = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="handleBatchGenerate">產生帳款</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 單筆新增 / 編輯 Dialog -->
    <v-dialog v-model="editModal" :max-width="xs ? undefined : 440" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingItem ? '編輯帳款' : '單筆新增帳款' }}</span>
          <v-btn icon variant="text" @click="editModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editForm.category"
            label="帳款類別"
            :items="categoryOptions"
            density="compact" variant="outlined" class="mb-2"
            @update:model-value="onEditCategoryChange"
          />
          <v-autocomplete
            v-model="editForm.memberName"
            label="社友"
            :items="memberNames"
            density="compact" variant="outlined" class="mb-2"
          />
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="editForm.amount" label="金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="editForm.dueDate" label="應收日期" type="date" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select
            v-model="editForm.accountCode"
            label="入帳科目"
            :items="receivableAcctOptions"
            density="compact" variant="outlined" class="mb-2"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="editModal = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="handleSaveEdit">儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 收款 Dialog -->
    <v-dialog v-model="collectModal" :max-width="xs ? undefined : 420" :fullscreen="xs">
      <v-card v-if="collectingItem">
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">新增收款</span>
          <v-btn icon variant="text" @click="collectModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-card variant="tonal" color="primary" class="pa-3 mb-3">
            <div class="text-caption">{{ collectingItem.memberName }}．{{ collectingItem.sourceRef }}</div>
            <div class="d-flex justify-space-between mt-1">
              <span class="text-caption">應收 {{ collectingItem.amount.toLocaleString() }}</span>
              <span class="text-caption">已收 {{ paidOf(collectingItem).toLocaleString() }}</span>
              <span class="text-caption font-weight-bold text-error">未收 {{ remainingOf(collectingItem).toLocaleString() }}</span>
            </div>
          </v-card>
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="collectForm.date" label="收款日期" type="date" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="collectForm.amount" label="沖款金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select v-model="collectForm.account" label="收款帳戶 / 經手人" :items="fundOptions" density="compact" variant="outlined" class="mb-1" />
          <v-text-field v-model="collectForm.remark" label="備註（選填）" density="compact" variant="outlined" />
          <div v-if="collectOverRemaining" class="text-caption text-warning">
            沖款金額大於未收餘額，將以未收餘額 {{ remainingOf(collectingItem).toLocaleString() }} 沖抵。
          </div>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="collectModal = false">取消</v-btn>
          <v-btn color="success" variant="flat" :loading="saving" @click="handleCollect">確認收款</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- 收款對帳 Dialog -->
    <v-dialog v-model="matchModal" :max-width="xs ? undefined : 640" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">收款對帳</span>
          <v-btn icon variant="text" @click="matchModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <div class="text-caption text-medium-emphasis mb-2">
            輸入銀行明細的<strong>金額</strong>、<strong>帳號末碼</strong>或<strong>姓名</strong>，系統即時比對付款人與未收帳款；點候選人後勾選要沖帳的項目。
          </div>
          <v-row dense>
            <v-col cols="4">
              <v-text-field v-model="matchForm.amount" label="收到金額" type="number" density="compact" variant="outlined" hide-details />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model="matchForm.last5" label="帳戶末碼" density="compact" variant="outlined" hide-details placeholder="例：12345" />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model="matchForm.name" label="姓名 / 社名" density="compact" variant="outlined" hide-details />
            </v-col>
          </v-row>

          <!-- 候選付款人 -->
          <v-card variant="outlined" class="mt-3 pa-2" style="max-height:300px;overflow-y:auto">
            <div v-if="!matchCandidates.length" class="text-caption text-medium-emphasis pa-3 text-center">
              輸入條件後即時列出可能的付款人
            </div>
            <div
              v-for="c in matchCandidates" :key="c.member.id"
              class="pa-2 rounded mb-1"
              :style="matchSelected === c.member.name ? 'background:#eef2ff;border:1px solid #6366f1' : 'background:#f8fafc;cursor:pointer'"
              @click="selectMatchCandidate(c)"
            >
              <div class="d-flex justify-space-between align-center">
                <div class="d-flex align-center ga-2">
                  <span class="text-body-2 font-weight-bold">{{ c.member.name }}</span>
                  <span v-if="c.member.nickname" class="text-caption text-medium-emphasis">{{ c.member.nickname }}</span>
                  <v-chip v-for="r in c.reasons" :key="r" size="x-small" color="success" variant="tonal">{{ r }}</v-chip>
                </div>
                <span class="text-caption">未收 {{ c.outstanding.length }} 筆，合計 <b>{{ c.total.toLocaleString() }}</b></span>
              </div>
              <!-- 展開：勾選沖帳項目 -->
              <div v-if="matchSelected === c.member.name" class="mt-2" @click.stop>
                <div v-for="r in c.outstanding" :key="r.id" class="d-flex align-center ga-1">
                  <v-checkbox-btn v-model="matchPicked" :value="r.id" density="compact" />
                  <span class="text-caption flex-grow-1">
                    {{ r.sourceRef }}（{{ r.dueDate || '未指定' }}）
                    <v-chip v-if="r.status === 'partial'" size="x-small" color="warning" variant="tonal">已收 {{ (r.paidAmount || 0).toLocaleString() }}</v-chip>
                  </span>
                  <span class="text-caption font-weight-bold">{{ remainingOf(r).toLocaleString() }}</span>
                </div>
                <div v-if="!c.outstanding.length" class="text-caption text-medium-emphasis">此社友無未收帳款</div>
              </div>
            </div>
          </v-card>

          <!-- 沖帳摘要 -->
          <div v-if="matchSelected" class="d-flex justify-space-between align-center mt-2 text-caption">
            <span>已勾 {{ matchPicked.length }} 筆，合計 <b>{{ matchPickedTotal.toLocaleString() }}</b></span>
            <span v-if="parseFloat(matchForm.amount) > 0">
              收到 {{ (parseFloat(matchForm.amount) || 0).toLocaleString() }}：
              <span v-if="Math.abs(matchPickedTotal - (parseFloat(matchForm.amount) || 0)) < 0.5" class="text-success font-weight-bold">金額吻合</span>
              <span v-else-if="matchPickedTotal < (parseFloat(matchForm.amount) || 0)" class="text-warning">溢收 {{ ((parseFloat(matchForm.amount) || 0) - matchPickedTotal).toLocaleString() }} 將掛暫收款</span>
              <span v-else class="text-error">金額不足 {{ (matchPickedTotal - (parseFloat(matchForm.amount) || 0)).toLocaleString() }}，尾筆將列部分收款</span>
            </span>
          </div>

          <v-row dense class="mt-2">
            <v-col cols="6">
              <v-text-field v-model="matchForm.date" label="收款日期" type="date" density="compact" variant="outlined" hide-details />
            </v-col>
            <v-col cols="6">
              <v-select v-model="matchForm.account" label="收款帳戶" :items="fundOptions" density="compact" variant="outlined" hide-details />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="matchForm.remark" label="備註（選填）" density="compact" variant="outlined" hide-details />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="matchModal = false">取消</v-btn>
          <v-btn color="success" variant="flat" :loading="saving" :disabled="!matchPicked.length" @click="handleMatchSettle">確認沖帳</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { buildFundAccountOptions, LEGACY_INCOME_ACCOUNT_MAP, CODES } from '../accounting/coa.js'
import { fyOf, fyLabel, toMinguoDate, DUES_QUARTERS, duesQuarterPeriod } from '../accounting/fiscal.js'
import { balancesAsOf } from '../accounting/ledger.js'
import PrintSheet from '../components/PrintSheet.vue'

const { xs } = useDisplay()

const members = inject('members')
const accounts = inject('accounts')
const appSettings = inject('appSettings')
const receivables = inject('receivables')
const recLoading = inject('recLoading')
const duesSettings = inject('duesSettings')
const fetchReceivables = inject('fetchReceivables')
const fetchRecords = inject('fetchRecords')
const waiveReceivable = inject('waiveReceivable')
const reopenReceivable = inject('reopenReceivable')
const batchGenerate = inject('batchGenerate')
const createReceivable = inject('createReceivable')
const updateReceivable = inject('updateReceivable')
const deleteReceivable = inject('deleteReceivable')
const collectReceivable = inject('collectReceivable')
const settleBatch = inject('settleBatch')
const accounting = inject('accounting')

const selectedYear = ref(new Date().getFullYear().toString())
const filterMember = ref(null)
const filterStatus = ref('all')
const filterPeriod = ref(null)
const filterNature = ref(null)
const filterItem = ref(null)
const saving = ref(false)

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }
function todayStr() { return new Date().toISOString().split('T')[0] }

// ── 帳期（民國年月，如 11507）與性質推導 ──
function periodOf(r) {
  const ym = r.periodStart || (r.dueDate ? r.dueDate.substring(0, 7) : '')
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return `${parseInt(y) - 1911}${m}`
}
function natureOf(r) {
  if (r.sourceType === 'agency' || r.accountCode === CODES.AGENCY) return '代收'
  if (r.accountCode === '4101' || r.accountCode === '4106') return '社費'
  if (r.accountCode === '4102') return '紅箱'
  if ((r.accountCode || '').startsWith('5')) return '補助'
  if (r.accountCode === CODES.TEMP_RECEIPT) return '暫收'
  return '其他'
}
function natureColor(nature) {
  return { 社費: 'primary', 紅箱: 'pink', 代收: 'warning', 補助: 'teal', 暫收: 'grey' }[nature] || 'grey'
}

// 年度為前端過濾（receivables 為全量載入，分錄引擎共用）
const availableYears = computed(() => {
  const years = [...new Set((receivables.value || []).map(r => r.dueYear))]
  if (!years.includes(selectedYear.value)) years.push(selectedYear.value)
  return years.sort((a, b) => b - a)
})

// 開單/批次名單只列現職社友（退社社友的既有欠費仍可於列表追蹤收款）
const memberNames = computed(() => (members.value || []).filter(m => m.status !== 'left').map(m => m.name))
const categoryOptions = computed(() => (duesSettings.value || []).map(s => s.category))
const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))
const monthlyDues = computed(() => parseFloat(appSettings?.value?.['dues.monthlyAmount']) || 6000)

// 開單入帳科目：收入葉節點 + 代收/暫收
const receivableAcctOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  const leaves = list.filter(a => !hasChildren.has(a.code))
  return [
    ...leaves.filter(a => a.type === 'income'),
    ...leaves.filter(a => a.type === 'liability' && [CODES.AGENCY, CODES.TEMP_RECEIPT].includes(a.code)),
  ].map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})

// ── 金額輔助 ──
function paidOf(item) {
  if (item.status === 'paid') return item.paidAmount != null ? item.paidAmount : item.amount
  if (item.status === 'partial') return item.paidAmount || 0
  return 0
}
function remainingOf(item) {
  if (item.status === 'waived') return 0
  // 負數帳款（補助抵減）未收為負值，須計入合計與勾稽，不截斷為 0
  return Math.round((item.amount - paidOf(item)) * 100) / 100
}

// ── 篩選（帳期/性質/項目/對象逐欄；狀態另計）──
const yearItems = computed(() => (receivables.value || []).filter(r => r.dueYear === selectedYear.value))

function applyColumnFilters(items) {
  let out = items
  if (filterPeriod.value) out = out.filter(r => periodOf(r) === filterPeriod.value)
  if (filterNature.value) out = out.filter(r => natureOf(r) === filterNature.value)
  if (filterItem.value) out = out.filter(r => r.sourceRef === filterItem.value)
  if (filterMember.value) out = out.filter(r => r.memberName === filterMember.value)
  return out
}

const periodOptions = computed(() => [...new Set(yearItems.value.map(periodOf))].sort())
const natureOptions = computed(() => [...new Set(yearItems.value.map(natureOf))].sort())
const itemOptions = computed(() => [...new Set(yearItems.value.map(r => r.sourceRef))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
const targetOptions = computed(() => [...new Set(yearItems.value.map(r => r.memberName))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))

const filteredReceivables = computed(() => {
  let items = applyColumnFilters(yearItems.value)
  if (filterStatus.value === 'paid') items = items.filter(r => r.status === 'paid')
  else if (filterStatus.value === 'waived') items = items.filter(r => r.status === 'waived')
  else if (filterStatus.value === 'unpaid') items = items.filter(r => r.status === 'pending' || r.status === 'partial')
  return items
})

const yearSummary = computed(() => {
  const items = applyColumnFilters(yearItems.value)
  const active = items.filter(r => r.status !== 'waived')
  const totalTarget = active.reduce((s, r) => s + r.amount, 0)
  const totalPaid = active.reduce((s, r) => s + paidOf(r), 0)
  const totalWaived = items.filter(r => r.status === 'waived').reduce((s, r) => s + r.amount, 0)
  return { totalTarget, totalPaid, totalUnpaid: totalTarget - totalPaid, totalWaived }
})

// ── 平表列（帳期→項目→對象排序）＋分頁 ──
const tableRows = computed(() =>
  [...filteredReceivables.value].sort((a, b) =>
    periodOf(a).localeCompare(periodOf(b)) ||
    a.sourceRef.localeCompare(b.sourceRef, 'zh-Hant') ||
    a.memberName.localeCompare(b.memberName, 'zh-Hant')
  )
)
const tableTotals = computed(() => {
  const active = tableRows.value.filter(r => r.status !== 'waived')
  const amount = Math.round(active.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const paid = Math.round(active.reduce((s, r) => s + paidOf(r), 0) * 100) / 100
  return { amount, paid, remaining: Math.round((amount - paid) * 100) / 100 }
})
const TABLE_PAGE_SIZE = 50
const tablePage = ref(1)
const tablePages = computed(() => Math.max(1, Math.ceil(tableRows.value.length / TABLE_PAGE_SIZE)))
const pagedRows = computed(() => {
  const p = Math.min(tablePage.value, tablePages.value)
  return tableRows.value.slice((p - 1) * TABLE_PAGE_SIZE, p * TABLE_PAGE_SIZE)
})
watch([selectedYear, filterPeriod, filterNature, filterItem, filterMember, filterStatus], () => { tablePage.value = 1 })

// ── 批次產生 ──
const batchModal = ref(false)
const batchForm = ref(makeBatchForm())

function makeBatchForm() {
  return { category: '', amount: '', dueDate: '', accountCode: null, periodStart: null, periodEnd: null, members: [] }
}

// 季度社費快速開單
const quickFy = ref(fyOf(todayStr()))
const quickQuarter = ref(null)
const quickFyOptions = computed(() => {
  const fy = fyOf(todayStr())
  return [fy - 1, fy, fy + 1].map(f => ({ title: fyLabel(f), value: f }))
})
const quarterOptions = DUES_QUARTERS.map(q => ({ title: `${q.label}社費`, value: q.q }))

function applyQuickDues() {
  const info = duesQuarterPeriod(quickFy.value, quickQuarter.value)
  if (!info) return
  batchForm.value.category = info.categoryName
  batchForm.value.amount = monthlyDues.value * 3
  batchForm.value.dueDate = info.dueDate
  batchForm.value.accountCode = CODES.DUES_INCOME
  batchForm.value.periodStart = info.periodStart
  batchForm.value.periodEnd = info.periodEnd
}

const batchPeriodLabel = computed(() =>
  batchForm.value.periodStart ? `${batchForm.value.periodStart} ~ ${batchForm.value.periodEnd}` : ''
)

function openBatchModal() {
  quickQuarter.value = null
  batchForm.value = { ...makeBatchForm(), members: [...memberNames.value] }
  batchModal.value = true
}
function selectAllMembers() {
  batchForm.value.members = [...memberNames.value]
}
function onBatchCategoryChange(cat) {
  const s = (duesSettings.value || []).find(x => x.category === cat)
  if (s) {
    batchForm.value.amount = s.standardAmount || ''
    batchForm.value.dueDate = s.dueDate || ''
    batchForm.value.accountCode = s.accountCode || LEGACY_INCOME_ACCOUNT_MAP[s.incomeAccount] || null
    // 期間由後端依 periodMonths 推得；此處僅顯示提示
    batchForm.value.periodStart = null
    batchForm.value.periodEnd = null
  }
}

async function handleBatchGenerate() {
  if (!batchForm.value.category) {
    Swal.fire({ icon: 'warning', title: '請選擇帳款類別', confirmButtonColor: '#4f46e5' }); return
  }
  if (batchForm.value.members.length === 0) {
    Swal.fire({ icon: 'warning', title: '請至少選擇一位社友', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const result = await batchGenerate({
      category: batchForm.value.category,
      memberNames: batchForm.value.members,
      amount: parseFloat(batchForm.value.amount) || 0,
      dueDate: batchForm.value.dueDate || '',
      accountCode: batchForm.value.accountCode || null,
      periodStart: batchForm.value.periodStart || null,
      periodEnd: batchForm.value.periodEnd || null,
    })
    const year = (batchForm.value.dueDate || '').substring(0, 4) || selectedYear.value
    selectedYear.value = year
    await fetchReceivables()
    batchModal.value = false
    Swal.fire({
      icon: 'success', title: '批次產生完成',
      html: `新增 <b>${result.created}</b> 筆${result.skipped ? `，略過 <b>${result.skipped}</b> 筆（已存在）` : ''}`,
      confirmButtonColor: '#4f46e5',
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '產生失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 單筆新增 / 編輯 ──
const editModal = ref(false)
const editingItem = ref(null)
const editForm = ref({ category: '', memberName: '', amount: '', dueDate: '', accountCode: null })

function openCreateModal() {
  editingItem.value = null
  editForm.value = { category: '', memberName: '', amount: '', dueDate: '', accountCode: null }
  editModal.value = true
}
function openEditModal(item) {
  editingItem.value = item
  editForm.value = {
    category: item.sourceRef,
    memberName: item.memberName,
    amount: (item.amount ?? '').toString(),
    dueDate: item.dueDate || '',
    accountCode: item.accountCode || LEGACY_INCOME_ACCOUNT_MAP[item.incomeAccount] || null,
  }
  editModal.value = true
}
function onEditCategoryChange(cat) {
  const s = (duesSettings.value || []).find(x => x.category === cat)
  if (s) {
    if (!editForm.value.amount) editForm.value.amount = s.standardAmount || ''
    if (!editForm.value.dueDate) editForm.value.dueDate = s.dueDate || ''
    if (!editForm.value.accountCode) editForm.value.accountCode = s.accountCode || LEGACY_INCOME_ACCOUNT_MAP[s.incomeAccount] || null
  }
}

async function handleSaveEdit() {
  if (!editForm.value.category || !editForm.value.memberName) {
    Swal.fire({ icon: 'warning', title: '請填寫類別與社友', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      await updateReceivable(editingItem.value.id, {
        sourceRef: editForm.value.category,
        memberName: editForm.value.memberName,
        amount: parseFloat(editForm.value.amount) || 0,
        dueDate: editForm.value.dueDate || '',
        accountCode: editForm.value.accountCode || null,
      })
    } else {
      await createReceivable({
        category: editForm.value.category,
        memberName: editForm.value.memberName,
        amount: parseFloat(editForm.value.amount) || 0,
        dueDate: editForm.value.dueDate || '',
        accountCode: editForm.value.accountCode || null,
      })
    }
    const year = (editForm.value.dueDate || '').substring(0, 4) || selectedYear.value
    if (year !== selectedYear.value) selectedYear.value = year
    await fetchReceivables()
    editModal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 收款 ──
const collectModal = ref(false)
const collectingItem = ref(null)
const collectForm = ref({ date: todayStr(), amount: '', account: '一銀帳戶', remark: '' })

const collectOverRemaining = computed(() => {
  if (!collectingItem.value) return false
  const entered = parseFloat(collectForm.value.amount)
  return entered > remainingOf(collectingItem.value)
})

function openCollectModal(item) {
  collectingItem.value = item
  collectForm.value = {
    date: todayStr(),
    amount: remainingOf(item).toString(),
    account: '一銀帳戶',
    remark: '',
  }
  collectModal.value = true
}

async function handleCollect() {
  if (!collectForm.value.date || !collectForm.value.account) {
    Swal.fire({ icon: 'warning', title: '請填寫收款日期與帳戶', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const result = await collectReceivable(collectingItem.value.id, {
      date: collectForm.value.date,
      amount: parseFloat(collectForm.value.amount) || 0,
      account: collectForm.value.account,
      remark: collectForm.value.remark,
    })
    await Promise.all([fetchRecords(), fetchReceivables()])
    collectModal.value = false
    Swal.fire({
      icon: 'success', title: '收款完成',
      html: `已沖抵 NT$ <b>${(result.applied || 0).toLocaleString()}</b>`,
      timer: 1500, showConfirmButton: false,
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '收款失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 明細↔總帳勾稽（應收明細未收合計 vs 引擎 1111 餘額）──
const arTieOut = computed(() => {
  const detailTotal = (receivables.value || []).reduce((s, r) => s + remainingOf(r), 0)
  const { byCode } = balancesAsOf(accounting.entries.value, {})
  const b = byCode.get(CODES.RECEIVABLE) || { debit: 0, credit: 0 }
  const ledgerTotal = Math.round((b.debit - b.credit) * 100) / 100
  return {
    detailTotal: Math.round(detailTotal * 100) / 100,
    ledgerTotal,
    matched: Math.round(detailTotal * 100) === Math.round(ledgerTotal * 100),
  }
})

// ── 收款對帳（金額＋帳戶末碼＋姓名 → 比對付款人與未收帳款）──
const matchModal = ref(false)
const matchForm = ref({ amount: '', last5: '', name: '', date: todayStr(), account: '一銀帳戶', remark: '' })
const matchSelected = ref(null) // 展開中的社友姓名
const matchPicked = ref([])     // 勾選沖帳的 receivable id

function openMatchModal() {
  matchForm.value = { amount: '', last5: '', name: '', date: todayStr(), account: '一銀帳戶', remark: '' }
  matchSelected.value = null
  matchPicked.value = []
  matchModal.value = true
}

// 比對未收帳款（pending＋partial，partial 以剩餘額沖抵）
function pendingOf(memberName) {
  return (receivables.value || [])
    .filter(r => r.memberName === memberName && (r.status === 'pending' || r.status === 'partial'))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
}

const matchCandidates = computed(() => {
  const amt = parseFloat(matchForm.value.amount) || 0
  const last5 = (matchForm.value.last5 || '').trim()
  const nameKw = (matchForm.value.name || '').trim()
  if (!amt && !last5 && !nameKw) return []
  const out = []
  for (const m of members.value || []) {
    const outstanding = pendingOf(m.name)
    const total = Math.round(outstanding.reduce((s, r) => s + remainingOf(r), 0) * 100) / 100
    let score = 0
    const reasons = []
    if (last5 && m.bankAccountLast5 &&
        (m.bankAccountLast5.endsWith(last5) || last5.endsWith(m.bankAccountLast5))) {
      score += 3; reasons.push(`帳號末碼 ${m.bankAccountLast5}`)
    }
    if (nameKw && (m.name.includes(nameKw) || (m.nickname || '').toLowerCase().includes(nameKw.toLowerCase()))) {
      score += 2; reasons.push('姓名相符')
    }
    if (amt && outstanding.length) {
      if (outstanding.some(r => Math.abs(remainingOf(r) - amt) < 0.5)) { score += 2; reasons.push('單筆金額吻合') }
      else if (Math.abs(total - amt) < 0.5) { score += 2; reasons.push('未收合計吻合') }
      else {
        let acc = 0
        for (const r of outstanding) {
          acc += remainingOf(r)
          if (Math.abs(acc - amt) < 0.5) { score += 1; reasons.push('連續多筆合計吻合'); break }
        }
      }
    }
    if (!score) continue
    out.push({ member: m, outstanding, total, score, reasons })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 10)
})

function selectMatchCandidate(c) {
  matchSelected.value = c.member.name
  const amt = parseFloat(matchForm.value.amount) || 0
  // 預選：單筆金額剛好 → 選那筆；否則依到期序累加不超過收到金額
  const exact = c.outstanding.find(r => Math.abs(remainingOf(r) - amt) < 0.5)
  if (amt && exact) {
    matchPicked.value = [exact.id]
    return
  }
  const picked = []
  let acc = 0
  for (const r of c.outstanding) {
    if (!amt || acc + remainingOf(r) <= amt + 0.5) { picked.push(r.id); acc += remainingOf(r) }
  }
  matchPicked.value = picked
}

const matchPickedTotal = computed(() => {
  const ids = new Set(matchPicked.value)
  return Math.round((receivables.value || [])
    .filter(r => ids.has(r.id))
    .reduce((s, r) => s + remainingOf(r), 0) * 100) / 100
})

async function handleMatchSettle() {
  const amt = parseFloat(matchForm.value.amount) || 0
  if (!matchSelected.value || !matchPicked.value.length) {
    Swal.fire({ icon: 'warning', title: '請選擇付款人並勾選要沖帳的帳款', confirmButtonColor: '#4f46e5' }); return
  }
  if (amt <= 0) {
    Swal.fire({ icon: 'warning', title: '請輸入收到金額', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const remark = [matchForm.value.remark, matchForm.value.last5 ? `對帳末碼 ${matchForm.value.last5}` : '']
      .filter(Boolean).join('；')
    const result = await settleBatch({
      memberName: matchSelected.value,
      date: matchForm.value.date,
      account: matchForm.value.account,
      receivableIds: matchPicked.value,
      receivedAmount: amt,
      prevOverpayment: 0,
      remark,
    })
    await Promise.all([fetchRecords(), fetchReceivables()])
    matchModal.value = false
    const surplusNote = result.surplus > 0 ? `，溢收 NT$ <b>${result.surplus.toLocaleString()}</b> 已掛暫收款` : ''
    const partialNote = result.partialSettled?.length ? `，<b>${result.partialSettled.length}</b> 筆列部分收款` : ''
    const skippedNote = result.skipped?.length ? `，${result.skipped.length} 筆未分配到款項未沖` : ''
    Swal.fire({
      icon: 'success', title: '對帳收款完成',
      html: `已沖 <b>${result.settled.length}</b> 筆${partialNote}${surplusNote}${skippedNote}`,
      confirmButtonColor: '#4f46e5',
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '對帳收款失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 列印附表：全年度項目統計（性質 → 項目，不受畫面篩選影響）──
const printStats = computed(() => {
  const r2 = (n) => Math.round(n * 100) / 100
  const natureOrder = ['社費', '紅箱', '代收', '補助', '暫收', '其他']
  const byNature = new Map()
  for (const r of yearItems.value) {
    const n = natureOf(r)
    if (!byNature.has(n)) byNature.set(n, new Map())
    const items = byNature.get(n)
    if (!items.has(r.sourceRef)) items.set(r.sourceRef, { item: r.sourceRef, count: 0, target: 0, paid: 0, waived: 0 })
    const g = items.get(r.sourceRef)
    g.count++
    if (r.status === 'waived') g.waived += r.amount
    else { g.target += r.amount; g.paid += paidOf(r) }
  }
  return natureOrder.filter(n => byNature.has(n)).map(n => {
    const items = [...byNature.get(n).values()]
      .map(g => ({ ...g, target: r2(g.target), paid: r2(g.paid), waived: r2(g.waived), unpaid: r2(g.target - g.paid) }))
      .sort((a, b) => a.item.localeCompare(b.item, 'zh-Hant'))
    const sum = (f) => r2(items.reduce((s, g) => s + g[f], 0))
    return {
      nature: n, items,
      count: items.reduce((s, g) => s + g.count, 0),
      target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived'),
    }
  })
})
const printGrand = computed(() => {
  const r2 = (n) => Math.round(n * 100) / 100
  const sum = (f) => r2(printStats.value.reduce((s, g) => s + g[f], 0))
  return { count: printStats.value.reduce((s, g) => s + g.count, 0), target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived') }
})
function printReport() { window.print() }

// 催繳通知已移至「Line請款」頁（LineBilling.vue）

// ── 免繳 / 恢復 / 刪除 ──
async function handleWaive(item) {
  const { value: reason } = await Swal.fire({
    title: '免繳確認',
    html: `確定要將 <b>${item.memberName}</b> 的「${item.sourceRef}」標記為免繳嗎？`,
    input: 'text', inputLabel: '免繳原因（選填）', inputPlaceholder: '例：榮譽社友免繳',
    showCancelButton: true, confirmButtonColor: '#6b7280', cancelButtonColor: '#4f46e5',
    confirmButtonText: '確定免繳', cancelButtonText: '取消',
  })
  if (reason !== undefined) await waiveReceivable(item.id, reason || '')
}

async function handleReopen(item) {
  const result = await Swal.fire({
    title: '恢復為未收',
    html: `確定要將 <b>${item.memberName}</b> 的「${item.sourceRef}」恢復為未收嗎？<br><span class="text-caption">此帳款已產生的收款單將一併刪除，帳務自動回復。</span>`,
    icon: 'question',
    showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定恢復', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    await reopenReceivable(item.id)
    await Promise.all([fetchRecords(), fetchReceivables()])
  }
}

async function handleDelete(item) {
  const result = await Swal.fire({
    title: '刪除帳款',
    html: `確定要刪除 <b>${item.memberName}</b> 的「${item.sourceRef}」這筆帳款嗎？`,
    icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    try {
      await deleteReceivable(item.id)
    } catch (e) {
      Swal.fire({ icon: 'error', title: '刪除失敗', text: e.message, confirmButtonColor: '#ef4444' })
    }
  }
}
</script>
