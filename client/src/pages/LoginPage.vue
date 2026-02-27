<template>
  <v-app>
    <v-main class="login-bg">
      <v-container fluid class="fill-height pa-4">
        <v-row justify="center" align="center" class="fill-height">
          <v-col cols="12" sm="8" md="5" lg="4" xl="3">
            <v-card rounded="xl" elevation="8" class="pa-2 pa-sm-4">
              <!-- Logo 區 -->
              <v-card-item class="text-center pb-0">
                <v-icon size="56" color="primary" class="mb-3">mdi-wallet</v-icon>
                <v-card-title class="text-h5 font-weight-bold">社團收支系統</v-card-title>
                <v-card-subtitle class="mt-1">請登入以繼續</v-card-subtitle>
              </v-card-item>

              <v-card-text class="pt-4">
                <v-form @submit.prevent="handleLogin">
                  <v-text-field
                    v-model="username"
                    label="帳號"
                    prepend-inner-icon="mdi-account"
                    variant="outlined"
                    density="comfortable"
                    class="mb-3"
                    autocomplete="username"
                    :disabled="loading"
                    autofocus
                  />
                  <v-text-field
                    v-model="password"
                    label="密碼"
                    prepend-inner-icon="mdi-lock"
                    :type="showPwd ? 'text' : 'password'"
                    :append-inner-icon="showPwd ? 'mdi-eye-off' : 'mdi-eye'"
                    variant="outlined"
                    density="comfortable"
                    class="mb-1"
                    autocomplete="current-password"
                    :disabled="loading"
                    @click:append-inner="showPwd = !showPwd"
                  />

                  <v-alert
                    v-if="error"
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="mb-4"
                    :text="error"
                  />

                  <v-btn
                    type="submit"
                    color="primary"
                    size="large"
                    block
                    :loading="loading"
                    class="mt-2"
                  >
                    登入
                  </v-btn>
                </v-form>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'

const { login } = useAuth()

const username = ref('')
const password = ref('')
const showPwd = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '請輸入帳號與密碼'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await login(username.value, password.value)
    // 登入成功後父元件會因 isAuthenticated 改變而重新渲染
  } catch (e) {
    error.value = e.message || '登入失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}
</style>
