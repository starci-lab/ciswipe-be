import { Injectable } from "@nestjs/common"
import { Network } from "@/modules/common"

@Injectable()
export class LockService {
    private locks = new Map<string, Set<Network>>()

    /** Check and acquire lock */
    private acquire(key: string, network: Network): boolean {
        if (!this.locks.has(key)) {
            this.locks.set(key, new Set())
        }
        const set = this.locks.get(key)!
        if (set.has(network)) return false
        set.add(network)
        return true
    }

    private release(key: string, network: Network) {
        this.locks.get(key)?.delete(network)
    }

    /**
   * With lock
   */
    async withLocks(
        keys: Array<string>, 
        network: Network, 
        callback: () => Promise<void> | void
    ): Promise<void> {
        // try acquire all keys
        const acquired: string[] = []
        for (const key of keys) {
            if (!this.acquire(key, network)) {
            // if any key fails, release all acquired keys
                for (const k of acquired) this.release(k, network)
            }
            acquired.push(key)
        }    
        try {
            await callback()
        } finally {
            // release all keys
            for (const k of acquired) this.release(k, network)
        }
    }

    /** Check if lock is held */
    isLocked(key: string, network: Network): boolean {
        return this.locks.get(key)?.has(network) ?? false
    }
}