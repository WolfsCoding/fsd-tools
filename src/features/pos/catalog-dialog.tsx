import { useState } from "react"
import { useAtom } from "@effect/atom-react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { NumberField } from "@/components/number-field"
import { EmptyList } from "@/components/no-results"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { catalogAtom, type Menu, type Product } from "./order"
import { Price } from "./price"

/** Where the items with their prices and the menus made of them are kept. */
export function CatalogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [catalog, setCatalog] = useAtom(catalogAtom)
  const [addedId, setAddedId] = useState<string>()
  const named = catalog.products.filter((p) => p.name.trim())

  const setProduct = (id: string, patch: Partial<Product>) =>
    setCatalog({ ...catalog, products: catalog.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const setMenu = (id: string, patch: Partial<Menu>) =>
    setCatalog({ ...catalog, menus: catalog.menus.map((m) => (m.id === id ? { ...m, ...patch } : m)) })

  function addProduct() {
    const id = crypto.randomUUID()
    setAddedId(id)
    setCatalog({ ...catalog, products: [...catalog.products, { id, name: "", price: 0 }] })
  }

  function addMenu() {
    const id = crypto.randomUUID()
    setAddedId(id)
    setCatalog({ ...catalog, menus: [...catalog.menus, { id, name: "", price: 0, productIds: [] }] })
  }

  function removeProduct(id: string) {
    setCatalog({
      products: catalog.products.filter((p) => p.id !== id),
      menus: catalog.menus.map((m) => ({ ...m, productIds: m.productIds.filter((p) => p !== id) })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-4rem)] sm:max-w-xl">
        <DialogPanel className="grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>Sortiment</DialogTitle>
            <DialogDescription>Artikel mit Preisen, und Menüs, die mehrere Artikel zu einem Preis bündeln.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="products" className="min-h-0">
            <TabsList>
              <TabsTrigger value="products">Artikel</TabsTrigger>
              <TabsTrigger value="menus">Menüs</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="-mx-1 grid min-h-0 content-start gap-2 overflow-y-auto px-1 pb-1">
              {catalog.products.length === 0 && <EmptyList>Noch keine Artikel</EmptyList>}
              {catalog.products.map((product) => (
                <div key={product.id} className="grid grid-cols-[1fr_6rem_2.25rem] items-center gap-2">
                  <Input
                    value={product.name}
                    onChange={(e) => setProduct(product.id, { name: e.target.value })}
                    placeholder="Artikel"
                    aria-label="Artikel"
                    autoFocus={product.id === addedId}
                  />
                  <NumberField value={product.price} onChange={(price) => setProduct(product.id, { price })} label="Preis" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(product.id)}
                    aria-label={product.name.trim() ? `„${product.name.trim()}“ entfernen` : "Artikel entfernen"}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addProduct} className="justify-self-start">
                <PlusIcon /> Artikel
              </Button>
            </TabsContent>

            <TabsContent value="menus" className="-mx-1 grid min-h-0 content-start gap-3 overflow-y-auto px-1 pb-1">
              {catalog.menus.length === 0 && <EmptyList>Noch keine Menüs</EmptyList>}
              {catalog.menus.map((menu) => {
                const single = named.filter((p) => menu.productIds.includes(p.id)).reduce((sum, p) => sum + p.price, 0)
                return (
                  <div key={menu.id} className="grid gap-2 rounded-lg border p-2">
                    <div className="grid grid-cols-[1fr_6rem_2.25rem] items-center gap-2">
                      <Input
                        value={menu.name}
                        onChange={(e) => setMenu(menu.id, { name: e.target.value })}
                        placeholder="Menü"
                        aria-label="Menü"
                        autoFocus={menu.id === addedId}
                      />
                      <NumberField value={menu.price} onChange={(price) => setMenu(menu.id, { price })} label="Preis" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCatalog({ ...catalog, menus: catalog.menus.filter((m) => m.id !== menu.id) })}
                        aria-label={menu.name.trim() ? `„${menu.name.trim()}“ entfernen` : "Menü entfernen"}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                    {named.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Leg zuerst Artikel an, um sie dem Menü zuzuordnen.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {named.map((product) => (
                          <Toggle
                            key={product.id}
                            variant="outline"
                            size="sm"
                            pressed={menu.productIds.includes(product.id)}
                            onPressedChange={(on) =>
                              setMenu(menu.id, {
                                productIds: on ? [...menu.productIds, product.id] : menu.productIds.filter((id) => id !== product.id),
                              })
                            }
                          >
                            {product.name.trim()}
                          </Toggle>
                        ))}
                      </div>
                    )}
                    {single > 0 && <p className="text-xs text-muted-foreground">Einzeln zusammen <Price value={single} /></p>}
                  </div>
                )
              })}
              <Button variant="outline" size="sm" onClick={addMenu} className="justify-self-start">
                <PlusIcon /> Menü
              </Button>
            </TabsContent>
          </Tabs>
        </DialogPanel>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Fertig</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
