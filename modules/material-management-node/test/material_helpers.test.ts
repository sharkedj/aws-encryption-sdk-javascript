/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use
 * this file except in compliance with the License. A copy of the License is
 * located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-env mocha */

import { expect } from 'chai'
import 'mocha'
import { NodeDecryptionMaterial, NodeEncryptionMaterial, NodeAlgorithmSuite, AlgorithmSuiteIdentifier, KeyringTraceFlag, SignatureKey, VerificationKey } from '@aws-crypto/material-management'
import { nodeKdf, getCryptoStream, getEncryptHelper, getDecryptionHelper } from '../src/material_helpers'
// @ts-ignore
import { Decipheriv, Cipheriv, createECDH } from 'crypto'

describe('nodeKdf', () => {
  it('Check for early return (Postcondition): No Node.js KDF, just return the unencrypted data key.', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = nodeKdf(material, new Uint8Array(5))
    expect(test === dataKey).to.equal(true)
  })

  it('HKDF SHA256', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = nodeKdf(material, new Uint8Array(5))
    expect(test === dataKey).to.equal(false)
    expect(test.byteLength).to.equal(suite.keyLengthBytes)
  })

  it('HKDF SHA384', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES192_GCM_IV12_TAG16_HKDF_SHA384_ECDSA_P384)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = nodeKdf(material, new Uint8Array(5))
    expect(test === dataKey).to.equal(false)
    expect(test.byteLength).to.equal(suite.keyLengthBytes)
  })

  it('Precondition: Valid HKDF values must exist for Node.js.', () => {
    expect(() => nodeKdf({
      getUnencryptedDataKey () {},
      suite: {
        kdf: 'HKDF',
        kdfHash: 'sha256'
      } as any
    } as any, {} as any)).to.throw()

    expect(() => nodeKdf({
      getUnencryptedDataKey () {},
      suite: {
        kdf: 'NOT-HKDF',
        kdfHash: 'sha256'
      } as any
    } as any, new Uint8Array(8))).to.throw()

    expect(() => nodeKdf({
      getUnencryptedDataKey () {},
      suite: {
        kdf: 'NOT-HKDF',
        kdfHash: 'NOT-sha256'
      } as any
    } as any, new Uint8Array(8))).to.throw()
  })
})

describe('getCryptoStream', () => {
  it('return a Cipheriv', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = getCryptoStream(material)()
    const iv = new Uint8Array(12)
    const cipher = test(iv)
    expect(cipher).to.be.instanceOf(Cipheriv)
  })

  it('return a Decipheriv', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeDecryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_DECRYPTED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = getCryptoStream(material)()
    const iv = new Uint8Array(12)
    const decipher = test(iv)
    expect(decipher).to.be.instanceOf(Decipheriv)
  })

  it('Precondition: The length of the IV must match the algorithm suite specification.', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = getCryptoStream(material)()
    const iv = new Uint8Array(1)
    expect(() => test(iv)).to.throw()
  })

  it('Precondition: The material must have not been zeroed.', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const test = getCryptoStream(material)()
    material.zeroUnencryptedDataKey()
    const iv = new Uint8Array(12)
    expect(() => test(iv)).to.throw()
  })
})

describe('getEncryptHelper', () => {
  it('basic shape', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const helper = getEncryptHelper(material)
    expect(helper).to.haveOwnProperty('kdfGetCipher').and.to.be.a('function')
    expect(helper).to.haveOwnProperty('getSigner').and.to.equal(undefined)
    expect(helper).to.haveOwnProperty('dispose').and.to.be.a('function')
    const getCipher = helper.kdfGetCipher()
    const iv = new Uint8Array(12)
    const cipher = getCipher(iv)
    expect(cipher).to.be.instanceOf(Cipheriv)

    helper.dispose()
    expect(material.hasUnencryptedDataKey).to.equal(false)
  })

  it('signer', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES256_GCM_IV12_TAG16_HKDF_SHA384_ECDSA_P384)
    const material = new NodeEncryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }

    const ecdh = createECDH(suite.signatureCurve || '')
    ecdh.generateKeys()
    const sigKey = new SignatureKey(ecdh.getPrivateKey(), ecdh.getPublicKey(), suite)

    material
      .setUnencryptedDataKey(dataKey, trace)
      .setSignatureKey(sigKey)

    const helper = getEncryptHelper(material)
    if (typeof helper.getSigner !== 'function') throw new Error('bad')

    const getCipher = helper.kdfGetCipher(new Uint8Array(5))
    const iv = new Uint8Array(12)
    const cipher = getCipher(iv)
    expect(cipher).to.be.instanceOf(Cipheriv)

    const signer = helper.getSigner()
    expect(signer).to.haveOwnProperty('awsCryptoSign').and.to.be.a('function')
    signer.update('data')
    const sig = signer.awsCryptoSign()
    expect(sig).instanceOf(Buffer)
  })
})

describe('getDecryptionHelper', () => {
  it('first test', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeDecryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_DECRYPTED_DATA_KEY }
    material.setUnencryptedDataKey(dataKey, trace)

    const helper = getDecryptionHelper(material)
    expect(helper).to.haveOwnProperty('kdfGetDecipher').and.to.be.a('function')
    expect(helper).to.haveOwnProperty('getVerify').and.to.equal(undefined)
    expect(helper).to.haveOwnProperty('dispose').and.to.be.a('function')
    const getDecipher = helper.kdfGetDecipher()
    const iv = new Uint8Array(12)
    const decipher = getDecipher(iv)
    expect(decipher).to.be.instanceOf(Decipheriv)

    helper.dispose()
    expect(material.hasUnencryptedDataKey).to.equal(false)
  })

  it('verify', () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES256_GCM_IV12_TAG16_HKDF_SHA384_ECDSA_P384)
    const material = new NodeDecryptionMaterial(suite)
    const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
    const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_DECRYPTED_DATA_KEY }

    const ecdh = createECDH(suite.signatureCurve || '')
    ecdh.generateKeys()
    const verificationKey = new VerificationKey(ecdh.getPublicKey(), suite)

    material
      .setUnencryptedDataKey(dataKey, trace)
      .setVerificationKey(verificationKey)

    const helper = getDecryptionHelper(material)
    if (typeof helper.getVerify !== 'function') throw new Error('bad')

    const getDecipher = helper.kdfGetDecipher(new Uint8Array(5))
    const iv = new Uint8Array(12)
    const decipher = getDecipher(iv)

    expect(decipher).to.be.instanceOf(Decipheriv)

    const verify = helper.getVerify()
    expect(verify).to.haveOwnProperty('awsCryptoVerify').and.to.be.a('function')
    verify.update('data')
    const isValid = verify.awsCryptoVerify(Buffer.alloc(5))
    expect(isValid).to.equal(false)
  })
})
