/** 女友翻译器 · 情绪词典 / 话术模板 / 本地兜底关键词 */

export type EmotionId =
  | 'happy'
  | 'sweet'
  | 'calm'
  | 'tired'
  | 'upset'
  | 'angry'
  | 'disappointed'
  | 'jealous'
  | 'passive'
  | 'testing'
  | 'distant'

export interface ReplyTemplate {
  /** 中文风格标签 */
  tone: string
  /** 实际可发送的回复文案 */
  text: string
}

export interface EmotionDef {
  id: EmotionId
  label: string
  emoji: string
  accent: string
  /** 本地兜底参考生气值 */
  heat: number
  /** 提交给 Jev 的英文判定说明 */
  description: string
  /** 侧栏应对建议 */
  advice: string
  replies: ReplyTemplate[]
}

export const EMOTIONS: EmotionDef[] = [
  {
    id: 'happy',
    label: '开心',
    emoji: '😄',
    accent: '#34d399',
    heat: 0,
    description: 'She is genuinely happy, excited or amused and wants to share the joy.',
    advice: '接住情绪、追问细节，别只回一个「哈哈」。',
    replies: [
      { tone: '共情', text: '哈哈哈这么开心？快展开讲讲，我要听全过程！' },
      { tone: '夸夸', text: '笑死，你也太可爱了，今天这份快乐必须记下来。' },
      { tone: '贴贴', text: '看你这么开心，我心情也跟着起飞了，抱一个。' },
    ],
  },
  {
    id: 'sweet',
    label: '撒娇',
    emoji: '🥰',
    accent: '#ff4d8d',
    heat: 0,
    description: 'She is acting cute or clingy and wants attention, affection and a playful reply.',
    advice: '顺着她、宠着她，别讲道理。',
    replies: [
      { tone: '宠溺', text: '好好好，都听你的，过来抱一下，抱不够那种。' },
      { tone: '玩梗', text: '收到宝宝指令，已火速执行，请下达下一条指令。' },
      { tone: '直球', text: '你一撒娇我直接投降，说吧想干嘛都行。' },
    ],
  },
  {
    id: 'calm',
    label: '平静',
    emoji: '🙂',
    accent: '#22d3ee',
    heat: 0,
    description: 'Neutral, factual or casual; just chatting or sharing information without strong emotion.',
    advice: '正常接话并主动延伸话题，别冷场。',
    replies: [
      { tone: '接话', text: '收到～那你忙完了吗？晚上想吃点什么，我去安排。' },
      { tone: '关心', text: '好，知道啦。今天累不累，要不要早点休息？' },
      { tone: '延伸', text: '嗯嗯，然后呢？我还挺好奇后面怎么发展的。' },
    ],
  },
  {
    id: 'tired',
    label: '累了',
    emoji: '😮‍💨',
    accent: '#a9b4d0',
    heat: 3,
    description: 'Tired, stressed or emotionally drained. She wants comfort and company, not solutions.',
    advice: '先心疼、再陪伴，别急着给解决方案。',
    replies: [
      { tone: '陪伴', text: '辛苦啦，先别管别的，去泡个脚，我给你点你爱吃的那家。' },
      { tone: '倾听', text: '抱抱，今天是不是累坏了？慢慢说，我一直在。' },
      { tone: '安抚', text: '别硬撑了，过来靠一会儿，什么都不用想。' },
    ],
  },
  {
    id: 'upset',
    label: '委屈',
    emoji: '🥺',
    accent: '#7c5cff',
    heat: 6,
    description: 'Feeling wronged or hurt, often because of something you did or forgot. Needs acknowledgement, not excuses.',
    advice: '先承认她的感受，再谈事情本身。',
    replies: [
      { tone: '道歉', text: '是我不好，让你委屈了。对不起，你慢慢说，我认真听。' },
      { tone: '共情', text: '换我我也会难受，是我想得不够周到，真的对不起。' },
      { tone: '补救', text: '别一个人憋着，告诉我怎么做能让你好受一点，我马上做。' },
    ],
  },
  {
    id: 'angry',
    label: '生气',
    emoji: '😤',
    accent: '#f87171',
    heat: 9,
    description: 'Clearly angry or annoyed. Any defensiveness or excuse will make it much worse.',
    advice: '立刻认错、不辩解，先降温再复盘。',
    replies: [
      { tone: '认错', text: '我错了，是我没顾及你的感受。别气坏了，你说，我改。' },
      { tone: '降火', text: '先消消气，这事确实是我做得不对，我认真向你道歉。' },
      { tone: '表态', text: '这次是我不好，不找借口了，你说怎么罚我都认。' },
    ],
  },
  {
    id: 'disappointed',
    label: '失望',
    emoji: '😞',
    accent: '#64748b',
    heat: 7,
    description: 'Disappointed because expectations were not met. She may sound calm but distant and cold.',
    advice: '别找理由，给出具体改进和补偿方案。',
    replies: [
      { tone: '沟通', text: '我知道这次让你失望了。我不找理由，我们好好聊聊怎么补上。' },
      { tone: '承诺', text: '是我让你失望了，对不起。给我一次机会，我用行动证明。' },
      { tone: '追问', text: '你能跟我说说是哪件事最让你失望吗？我想把它改好。' },
    ],
  },
  {
    id: 'jealous',
    label: '吃醋',
    emoji: '😒',
    accent: '#fbbf24',
    heat: 5,
    description: 'Jealous or insecure about a person or situation. She wants reassurance that she is the priority.',
    advice: '给足安全感，主动划清边界。',
    replies: [
      { tone: '表态', text: '在我这儿你永远是第一位，别人连提都不用提。' },
      { tone: '行动', text: '你要是不舒服，我以后都不这样了。你比什么都重要。' },
      { tone: '甜', text: '吃醋的你我也喜欢，但别担心，我的准星只有你一个。' },
    ],
  },
  {
    id: 'passive',
    label: '阴阳怪气',
    emoji: '🌚',
    accent: '#fb923c',
    heat: 8,
    description:
      'Passive-aggressive or sarcastic. The literal words are the opposite of what she means; do NOT answer literally.',
    advice: '点破情绪、直接服软，别接字面意思。',
    replies: [
      { tone: '直球', text: '你这么说我心里也不好受。是不是我哪里做得不好，你直接说，我改。' },
      { tone: '服软', text: '懂了，是我错了，别阴阳我了，我心疼。' },
      { tone: '破冰', text: '感觉你在生我气。别憋着，骂我两句也行，别不理我。' },
    ],
  },
  {
    id: 'testing',
    label: '送命题',
    emoji: '🚨',
    accent: '#ef4444',
    heat: 5,
    description:
      'A trap or loaded question (e.g. "Do I look fat?", "What date is it today?"). A literal answer is dangerous; sincerity and attitude win.',
    advice: '别直答，先表态再给真诚答案。',
    replies: [
      { tone: '求生', text: '这题我不敢乱答。先说说你想要什么答案？我全力配合。' },
      { tone: '真诚', text: '我认真回答：我喜欢的是你本人，不是任何标准或数字。' },
      { tone: '甜', text: '答案是你呀——不管问什么，答案都是你。' },
    ],
  },
  {
    id: 'distant',
    label: '冷淡',
    emoji: '🧊',
    accent: '#38bdf8',
    heat: 6,
    description:
      'Short, cold or distant replies. She may be busy, upset, or giving you the cold shoulder. Probe gently.',
    advice: '轻声试探，给台阶也给空间。',
    replies: [
      { tone: '试探', text: '感觉你今天有点不对劲，是累了，还是我做错什么了？' },
      { tone: '主动', text: '在忙吗？忙完跟我说一声，我想你了。' },
      { tone: '空间', text: '好，那你先忙，我等你。需要我的时候随时叫我。' },
    ],
  },
]

export const EMOTION_MAP: Record<EmotionId, EmotionDef> = Object.fromEntries(
  EMOTIONS.map((emotion) => [emotion.id, emotion]),
) as Record<EmotionId, EmotionDef>

export interface IntentDef {
  id: string
  label: string
  description: string
}

export const INTENTS: IntentDef[] = [
  {
    id: 'comfort',
    label: '想被哄',
    description: 'She wants comfort, sweet talk and emotional support right now.',
  },
  {
    id: 'attention',
    label: '想被关注',
    description: 'She wants your attention, closeness or company immediately.',
  },
  {
    id: 'apology',
    label: '需要道歉',
    description: 'She expects a sincere apology and correction for something you did.',
  },
  {
    id: 'solve',
    label: '就事论事',
    description: 'She wants to talk through a concrete problem and reach a practical solution.',
  },
  {
    id: 'test',
    label: '试探态度',
    description: 'She is testing how much you care, whether you remember, or your attitude.',
  },
  {
    id: 'share',
    label: '单纯分享',
    description: 'She is just sharing something and wants active listening and reactions.',
  },
  {
    id: 'space',
    label: '需要空间',
    description: 'She wants some space for now, but must not feel abandoned or ignored.',
  },
]

export const INTENT_MAP: Record<string, IntentDef> = Object.fromEntries(
  INTENTS.map((intent) => [intent.id, intent]),
)

/** 0-10 生气值，作为 choice 的 11 个档位（score 类型最多只允许 10 档） */
export const ANGER_LEVELS: string[] = Array.from({ length: 11 }, (_, level) => {
  if (level === 0) return 'anger 0 of 10: completely calm, no anger at all'
  if (level <= 2) return `anger ${level} of 10: barely annoyed`
  if (level <= 4) return `anger ${level} of 10: mildly annoyed but still talking`
  if (level <= 6) return `anger ${level} of 10: clearly annoyed and cooling down`
  if (level <= 8) return `anger ${level} of 10: quite angry, words are sharp`
  return `anger ${level} of 10: furious, about to explode`
})

export function angerTone(anger: number): string {
  if (anger <= 1) return '#34d399'
  if (anger <= 3) return '#a3e635'
  if (anger <= 5) return '#fbbf24'
  if (anger <= 7) return '#fb923c'
  return '#f87171'
}

export function angerLabel(anger: number): string {
  if (anger <= 1) return '毫无波澜'
  if (anger <= 3) return '轻微不爽'
  if (anger <= 5) return '有点生气'
  if (anger <= 7) return '明显生气'
  if (anger <= 9) return '非常生气'
  return '濒临爆发'
}

export interface LocalHint {
  emotion: EmotionId
  anger: number
  words: string[]
}

/** 本地兜底：先匹配到的规则优先 */
export const LOCAL_HINTS: LocalHint[] = [
  {
    emotion: 'passive',
    anger: 8,
    words: ['呵呵', '随便', '没事', '不用了', '你玩吧', '你忙吧', '算了', '我哪有', '挺好的', '都行', '你决定', '打扰了'],
  },
  {
    emotion: 'angry',
    anger: 9,
    words: ['生气', '讨厌', '烦', '滚', '闭嘴', '过分', '凭什么', '受够', '别理我', '不想说话', '有完没完'],
  },
  {
    emotion: 'upset',
    anger: 6,
    words: ['委屈', '你都不', '从来不', '每次都是', '不在乎', '又忘了', '失望', '没人管'],
  },
  {
    emotion: 'testing',
    anger: 5,
    words: ['你觉得呢', '好看吗', '胖', '前女友', '谁好看', '重要吗', '还爱我吗', '错哪', '什么日子', '纪念日'],
  },
  {
    emotion: 'jealous',
    anger: 5,
    words: ['她是谁', '那个女生', '谁啊', '关系挺好啊', '聊得挺开心'],
  },
  {
    emotion: 'happy',
    anger: 0,
    words: ['哈哈', '开心', '好棒', '太好了', '嘻嘻', '耶', '好玩', '好看', '成功了'],
  },
  {
    emotion: 'sweet',
    anger: 0,
    words: ['嘛', '啦', '哼哼', '想你', '抱抱', '宝宝', '亲亲', '贴贴'],
  },
  {
    emotion: 'tired',
    anger: 3,
    words: ['累', '加班', '困', '压力', '忙死了', '头疼', '不想动'],
  },
]

/** 送命题本地兜底关键词 */
export const TRAP_HINTS = [
  '没事',
  '随便',
  '都行',
  '你决定',
  '呵呵',
  '算了',
  '你觉得呢',
  '我哪有',
  '不用了',
  '你玩吧',
  '你忙吧',
]

export const SAMPLE_MESSAGES = [
  '我没事，你玩吧',
  '你猜我今天遇到谁了？',
  '你到底还记不记得今天是什么日子？',
  '随便你，反正你也不在乎',
  '今天好累啊，不想动了',
]

export const MAX_MESSAGE_LENGTH = 300
export const MAX_HISTORY_TURNS = 8