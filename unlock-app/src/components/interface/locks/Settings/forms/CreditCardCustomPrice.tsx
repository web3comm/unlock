import { Placeholder, ToggleSwitch, Input, Button } from '@unlock-protocol/ui'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ToastHelper } from '~/components/helpers/toast.helper'
import { CREDIT_CARD_MIN_USD_PRICE } from '~/constants'
import { useSaveLockSettings } from '~/hooks/useLockSettings'
import { SettingCardDetail } from '../elements/SettingCard'
import { formatNumber } from '~/utils/formatter'
import { storage } from '~/config/storage'
import { useUSDPricing } from '~/hooks/useUSDPricing'

interface CreditCardFormSchema {
  creditCardPrice?: string | number | null
}

interface CreditCardCustomPriceProps {
  lockAddress: string
  network: number
  disabled: boolean
  lock: any
}

export default function CreditCardCustomPrice({
  lockAddress,
  network,
  disabled,
  lock,
}: CreditCardCustomPriceProps) {
  const [useCustomPrice, setUseCustomPrice] = useState(false)
  const [hasPriceConversion, setHasPriceConversion] = useState(false)

  const getDefaultValues = async (): Promise<CreditCardFormSchema> => {
    const settings = (await storage.getLockSettings(network, lockAddress)).data
    const price = settings?.creditCardPrice

    if (price) {
      const priceInUsd = parseFloat(formatNumber(price / 100)).toFixed(2)
      setUseCustomPrice(true) // enable toggle because it has custom price
      return {
        creditCardPrice: priceInUsd,
      }
    }

    return {
      creditCardPrice: undefined,
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreditCardFormSchema>({
    defaultValues: async () => await getDefaultValues(),
  })

  const {
    mutateAsync: saveSettingMutation,
    isLoading: isSaveLockSettingLoading,
  } = useSaveLockSettings()

  const { keyPrice, currencyContractAddress } = lock
  const { data: fiatPricing, isLoading } = useUSDPricing({
    lockAddress,
    network,
    currencyContractAddress,
    amount: parseFloat(keyPrice),
  })

  useEffect(() => {
    const pricing = fiatPricing?.usd?.amount || 0
    setHasPriceConversion(pricing > 0)
  }, [fiatPricing?.usd?.amount])

  const onSaveCreditCardPrice = async ({
    creditCardPrice,
  }: CreditCardFormSchema) => {
    const price = creditCardPrice
      ? parseFloat(`${creditCardPrice}`) * 100 // save price in basis points
      : null

    const savePricePromise = saveSettingMutation({
      lockAddress,
      network,
      creditCardPrice: price,
    })

    await ToastHelper.promise(savePricePromise, {
      loading: 'Updating price...',
      success: 'Price updated.',
      error: 'There is some issue updating the price.',
    })
  }

  const onSubmit = (fields: CreditCardFormSchema) => {
    onSaveCreditCardPrice(fields)
  }

  if (isLoading) {
    return (
      <Placeholder.Root>
        <Placeholder.Card />
      </Placeholder.Root>
    )
  }

  const saveDisabled = isSaveLockSettingLoading || disabled
  const toggleActive =
    !hasPriceConversion || (useCustomPrice && hasPriceConversion)

  const symbol = lock?.currencySymbol

  return (
    <div className="grid gap-2">
      <SettingCardDetail
        title="Set fixed price in USD"
        description={
          <span className="text-sm">
            {`If you set a custom price for card payments, we will use that one (+ fees) instead of converting the price of ${symbol} to USD.`}
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-1 p-4 bg-gray-100 rounded-lg">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid items-center gap-3"
        >
          <ToggleSwitch
            title="Use fixed price"
            enabled={toggleActive}
            disabled={!hasPriceConversion}
            setEnabled={setUseCustomPrice}
            onChange={(enabled) => {
              if (!enabled) {
                setValue('creditCardPrice', null, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            }}
          />
          {toggleActive && (
            <Input
              type="number"
              step="any"
              disabled={disabled}
              description="Set a fixed price in USD that is charged for card payments."
              error={errors?.creditCardPrice?.message}
              {...register('creditCardPrice', {
                required: {
                  value: toggleActive,
                  message: 'This field is required.',
                },
                min: {
                  value: CREDIT_CARD_MIN_USD_PRICE,
                  message: `Price is too low for us to process credit cards. It needs to be at least ${parseFloat(
                    `${CREDIT_CARD_MIN_USD_PRICE}`
                  ).toFixed(2)}. `,
                },
              })}
            />
          )}
          <div className="w-full md:w-1/3">
            <Button className="w-full" size="small" disabled={saveDisabled}>
              Apply
            </Button>
          </div>
        </form>
      </div>
      {!hasPriceConversion && (
        <span className="text-sm font-semibold text-red-600">
          {`We are not able to convert ${symbol} to USD. Please set a fixed price you want to charge for card payments.`}
        </span>
      )}
    </div>
  )
}
