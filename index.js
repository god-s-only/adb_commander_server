require('dotenv').config()

const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const cors = require('cors')

const app = express()

app.use('/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())
app.use(cors())

const PRO_AMOUNT = 200000
const CURRENCY = 'ngn'

app.post('/create-payment-intent', async (req, res) => {
    try {
        const { userId } = req.body
        if (!userId) return res.status(400).json({ error: 'userId is required' })

        const paymentIntent = await stripe.paymentIntents.create({
            amount: PRO_AMOUNT,
            currency: CURRENCY,
            metadata: {
                userId: userId,
                product: 'adb_commander_pro'
            },
            automatic_payment_methods: { enabled: true }
        })

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: PRO_AMOUNT,
            currency: CURRENCY
        })
    } catch (error) {
        console.error('create-payment-intent error:', error)
        res.status(500).json({ error: error.message })
    }
})

app.post('/verify-purchase', async (req, res) => {
    try {
        const { paymentIntentId, userId } = req.body
        if (!paymentIntentId || !userId) {
            return res.status(400).json({ error: 'paymentIntentId and userId required' })
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

        const isPro = paymentIntent.status === 'succeeded' &&
                      paymentIntent.metadata.userId === userId &&
                      paymentIntent.metadata.product === 'adb_commander_pro'

        res.json({ isPro, status: paymentIntent.status })
    } catch (error) {
        console.error('verify-purchase error:', error)
        res.status(500).json({ error: error.message })
    }
})

app.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (err) {
        console.error('Webhook signature failed:', err.message)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object
        console.log(`Payment succeeded for userId=${pi.metadata.userId}`)
    }

    res.json({ received: true })
})

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})