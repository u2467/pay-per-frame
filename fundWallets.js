const { Universal, Crypto } = require('@aeternity/aepp-sdk')
const BigNumber = require('bignumber.js')
const fs = require('fs')

const beneficiary = {
  publicKey: `ak_${Crypto.encodeBase58Check(fs.readFileSync('./docker/keys/beneficiary/key.pub'))}`,
  secretKey: fs.readFileSync('./docker/keys/beneficiary/key').toString('hex')
}

const keypairs = [
  {
    publicKey: 'ak_27JVhePzXxSRdVsszzVV9JHYc7x9A5xAPuF5aB3m9L9HW3aR7e',
    secretKey: 'c22f0c405d2a3794dfef6027e52a41721b031670a9df869f859a3fe847592dff920135e9eaefa64538506994c80abf8aa31596d29e84ce06c5a2ce46b06257cc'
  },
  {
    publicKey: 'ak_2DFSrgUg1UxomeoULyqB9QpFXcMeZteg6KasKE8PkaVX6sKNzt',
    secretKey: '24eacb21ecadcc1dbf335773dba02011d9ecd8310b03872bf4e7f6f18fd987649f825430d30a8e240b35c2abe91dfe4c072ab7bef9a54ec30529d9391975a1f3'
  },
  {
    publicKey: 'ak_2RVZ4xJSkHEnQaUBeR4cbR5FSaXkzhVvjZDNLsWyKQpj9qM9s3',
    secretKey: 'd654062ba859e733291e2ad68614508b6e6d627284a7e12420470f92787616dfbb4f101407e129c4327cb605beb2e0b8d2f79ec73202bb27bd616aa7d09bf64d'
  },
  {
    publicKey: 'ak_DhGpHJzXST5dV5GYPQL41XoqCnz569Wn8k9UoG7TGH2ADg14S',
    secretKey: '522e11a83c4a4d7570ec54258ef6394dea4f97f86af28c970b5b51f8406f5a1c1cd2f78494e596f7cea14d530cfb8ccf1a7a99cadd90e44db85f40a1860e5b1d'
  },
  {
    publicKey: 'ak_2tzpyVpuH5C8iwF5Ngqec7YdxHqPM66UbSqDx9sZZsGaCwVi9p',
    secretKey: '81e1b2876b49ba821e663690ba1f2eff424c2b7d61a19b546e8088c11dfd47aaf9c2fe1326dac9e7dd882b8ba91d8b9849f8d9fea44f1a5d14bc6ea3cf84f15a'
  }
]

;(async () => {
  const account = await Universal({
    url: 'http://localhost:3013',
    internalUrl: 'http://localhost:3013/internal',
    networkId: 'ae_devnet',
    keypair: beneficiary
  })

  console.log('Funding wallets...')

  for (let i = 0; i < keypairs.length; i++) {
    const { publicKey, secretKey } = keypairs[i]
    await account.spend(BigNumber('500e18'), publicKey)
    console.log(`\nAccount #${i + 1}`)
    console.log('PUBLIC KEY:', publicKey)
    console.log('SECRET KEY:', secretKey)
  }

  console.log('\nDone.')
})()