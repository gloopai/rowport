<script setup>
import CustomSelect from './CustomSelect.vue'
import {tlsModeOptions} from '../composables/connectionProfileUtils'

defineProps({
  open: {
    type: Boolean,
    default: false
  },
  editingProfileId: {
    type: String,
    default: ''
  },
  draftProfile: {
    type: Object,
    required: true
  },
  activeTab: {
    type: String,
    default: 'general'
  },
  testConnectionState: {
    type: Object,
    required: true
  },
  openSelectId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'submit', 'set-tab', 'test', 'choose-private-key', 'toggle-select', 'choose-tls-mode'])
</script>

<template>
  <div v-if="open" class="dialog-backdrop">
    <form class="dialog connection-dialog" @submit.prevent="emit('submit')">
      <header>
        <div class="dialog-title">
          <h2>{{ editingProfileId ? '编辑服务器' : '新增服务器' }}</h2>
          <span>{{ draftProfile.user || 'user' }}@{{ draftProfile.host || 'host' }}:{{ draftProfile.port || '3306' }}</span>
        </div>
        <button type="button" class="icon-close" @click="emit('close')">×</button>
      </header>

      <div class="dialog-body split-dialog-body">
        <aside class="dialog-tabs">
          <button type="button" :class="{active: activeTab === 'general'}" @click="emit('set-tab', 'general')">常规</button>
          <button type="button" :class="{active: activeTab === 'ssh'}" @click="emit('set-tab', 'ssh')">SSH</button>
          <button type="button" :class="{active: activeTab === 'tls'}" @click="emit('set-tab', 'tls')">TLS</button>
          <button type="button" :class="{active: activeTab === 'advanced'}" @click="emit('set-tab', 'advanced')">高级</button>
        </aside>

        <section class="dialog-pane">
          <div v-if="activeTab === 'general'" class="dialog-section">
            <h3>MySQL 连接</h3>
            <p>配置服务器地址、账号和默认数据库。密码可选择保存到系统钥匙串。</p>
            <div class="form-grid">
              <label class="field"><span>连接名称</span><input v-model="draftProfile.name" required data-native-context></label>
              <label class="field"><span>默认数据库</span><input v-model="draftProfile.database" placeholder="可选" data-native-context></label>
              <label class="field"><span>主机</span><input v-model="draftProfile.host" required data-native-context></label>
              <label class="field"><span>端口</span><input v-model="draftProfile.port" required data-native-context></label>
              <label class="field"><span>用户</span><input v-model="draftProfile.user" required data-native-context></label>
              <label class="field"><span>密码</span><input v-model="draftProfile.password" type="password" autocomplete="new-password" data-native-context></label>
            </div>
            <label class="check-row">
              <input v-model="draftProfile.rememberPassword" type="checkbox" data-native-context>
              <span>保存 MySQL 密码到系统钥匙串</span>
            </label>
          </div>

          <div v-if="activeTab === 'ssh'" class="dialog-section">
            <h3>SSH 隧道</h3>
            <p>需要通过跳板机访问 MySQL 时启用。可以使用 SSH 密码或私钥路径。</p>
            <label class="check-row enable-row">
              <input v-model="draftProfile.ssh.enabled" type="checkbox" data-native-context>
              <span>通过 SSH 连接</span>
            </label>
            <div class="form-grid" :class="{muted: !draftProfile.ssh.enabled}">
              <label class="field"><span>SSH 主机</span><input v-model="draftProfile.ssh.host" :disabled="!draftProfile.ssh.enabled" data-native-context></label>
              <label class="field"><span>SSH 端口</span><input v-model="draftProfile.ssh.port" :disabled="!draftProfile.ssh.enabled" data-native-context></label>
              <label class="field"><span>SSH 用户</span><input v-model="draftProfile.ssh.user" :disabled="!draftProfile.ssh.enabled" data-native-context></label>
              <label class="field"><span>SSH 密码</span><input v-model="draftProfile.ssh.password" :disabled="!draftProfile.ssh.enabled" type="password" data-native-context></label>
              <label class="field wide">
                <span>私钥路径</span>
                <div class="input-row">
                  <input v-model="draftProfile.ssh.privateKeyPath" :disabled="!draftProfile.ssh.enabled" placeholder="~/.ssh/id_rsa" data-native-context>
                  <button type="button" :disabled="!draftProfile.ssh.enabled" @click="emit('choose-private-key')">选择</button>
                </div>
              </label>
              <label class="field"><span>私钥口令</span><input v-model="draftProfile.ssh.passphrase" :disabled="!draftProfile.ssh.enabled" type="password" data-native-context></label>
              <label class="check-row"><input v-model="draftProfile.ssh.rememberPassword" :disabled="!draftProfile.ssh.enabled" type="checkbox" data-native-context><span>保存 SSH 密码</span></label>
              <label class="check-row"><input v-model="draftProfile.ssh.rememberPassphrase" :disabled="!draftProfile.ssh.enabled" type="checkbox" data-native-context><span>保存私钥口令</span></label>
            </div>
            <div class="host-key-row" :class="{muted: !draftProfile.ssh.enabled}">
              <div class="host-key-info">
                <span>已信任主机密钥</span>
                <code v-if="draftProfile.ssh.knownHostKey">{{ draftProfile.ssh.knownHostKey.slice(0, 48) }}…</code>
                <em v-else>首次连接时自动记住（信任首次使用）</em>
              </div>
              <button
                type="button"
                class="ghost"
                :disabled="!draftProfile.ssh.enabled || !draftProfile.ssh.knownHostKey"
                @click="draftProfile.ssh.knownHostKey = ''"
              >重置信任</button>
            </div>
          </div>

          <div v-if="activeTab === 'tls'" class="dialog-section">
            <h3>TLS / SSL</h3>
            <p>为 MySQL 连接启用加密。校验模式需要服务器使用受信任的证书。</p>
            <div class="form-grid">
              <label class="field">
                <span>TLS 模式</span>
                <CustomSelect
                  field
                  :options="tlsModeOptions"
                  :value="draftProfile.tls.mode"
                  fallback="禁用"
                  :open="openSelectId === 'tlsMode'"
                  @toggle="emit('toggle-select', 'tlsMode')"
                  @choose="emit('choose-tls-mode', $event)"
                />
              </label>
              <label class="field">
                <span>Server Name</span>
                <input v-model="draftProfile.tls.serverName" :disabled="draftProfile.tls.mode === 'disabled'" placeholder="默认使用主机名" data-native-context>
              </label>
              <label class="field wide">
                <span>CA 证书路径</span>
                <input v-model="draftProfile.tls.caCertPath" :disabled="draftProfile.tls.mode === 'disabled'" placeholder="校验模式下使用，留空则用系统根证书" data-native-context>
              </label>
              <label class="field">
                <span>客户端证书路径</span>
                <input v-model="draftProfile.tls.clientCertPath" :disabled="draftProfile.tls.mode === 'disabled'" placeholder="可选（双向 TLS）" data-native-context>
              </label>
              <label class="field">
                <span>客户端私钥路径</span>
                <input v-model="draftProfile.tls.clientKeyPath" :disabled="draftProfile.tls.mode === 'disabled'" placeholder="可选（双向 TLS）" data-native-context>
              </label>
            </div>
          </div>

          <div v-if="activeTab === 'advanced'" class="dialog-section">
            <h3>高级选项</h3>
            <p>调整连接建立和连接池参数。保存后下次连接生效。</p>
            <div class="form-grid">
              <label class="field">
                <span>连接超时（秒）</span>
                <input v-model.number="draftProfile.advanced.connectTimeoutSeconds" min="1" max="120" type="number" data-native-context>
              </label>
              <label class="field">
                <span>最大连接数</span>
                <input v-model.number="draftProfile.advanced.maxOpenConns" min="1" max="128" type="number" data-native-context>
              </label>
              <label class="field">
                <span>空闲连接数</span>
                <input v-model.number="draftProfile.advanced.maxIdleConns" min="0" max="128" type="number" data-native-context>
              </label>
              <div class="advanced-list">
                <div><span>密码存储</span><strong>系统钥匙串</strong></div>
                <div><span>字符集</span><strong>utf8mb4</strong></div>
              </div>
            </div>
          </div>

          <div v-if="testConnectionState.message" :class="['test-status', testConnectionState.status]">
            {{ testConnectionState.message }}
          </div>
        </section>
      </div>

      <footer>
        <button type="button" class="ghost" :disabled="testConnectionState.status === 'testing'" @click="emit('test')">测试连接</button>
        <span class="dialog-footer-spacer"></span>
        <button type="button" class="ghost" @click="emit('close')">取消</button>
        <button class="primary" type="submit">保存</button>
      </footer>
    </form>
  </div>
</template>
