import 'reflect-metadata'

import { HttpServer } from './http-server'
import { HttpClient } from './http-client'
import { IJsFixConfig } from '../../../config'
import { Launcher } from '../../launcher'
import { HttpAcceptorListener, HttpJsonSampleAdapter, HttpInitiator } from '../../../transport/http'
import { DependencyContainer } from 'tsyringe'
import { DITokens } from '../../../runtime/DITokens'

class AppLauncher extends Launcher {
  public constructor () {
    super(
      'data/session/test-http-initiator.json',
      'data/session/test-http-acceptor.json')
  }

  protected override registerApplication (sessionContainer: DependencyContainer) {
    const config: IJsFixConfig = sessionContainer.resolve<IJsFixConfig>(DITokens.IJsFixConfig)
    const isInitiator = this.isInitiator(config.description)
    if (isInitiator) {
      sessionContainer.register(DITokens.FixSession, {
        useClass: HttpClient
      })
    } else {
      sessionContainer.register(DITokens.FixSession, {
        useClass: HttpServer
      })
    }
    sessionContainer.register('logoutSeconds', {
      useValue: 45
    })
  }

  protected getAcceptor (sessionContainer: DependencyContainer): Promise<any> {
    const listener = sessionContainer.resolve<HttpAcceptorListener>(HttpAcceptorListener)
    return listener.start()
  }

  protected getInitiator (sessionContainer: DependencyContainer): Promise<any> {
    const config: IJsFixConfig = sessionContainer.resolve<IJsFixConfig>(DITokens.IJsFixConfig)
    config.description.application.http.adapter = new HttpJsonSampleAdapter(config)
    const initiator = sessionContainer.resolve<HttpInitiator>(HttpInitiator)
    return initiator.start()
  }
}

const l = new AppLauncher()
l.run().then(() => {
  console.log('finished.')
}).catch(e => {
  console.log(e)
})
