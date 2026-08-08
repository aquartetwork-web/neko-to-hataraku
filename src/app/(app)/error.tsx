"use client";

import { RotateCcw } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardBody>
        <div className="app-error" role="alert">
          <div>
            <h2 className="card__title">データを読み込めませんでした</h2>
            <p className="card__description">
              通信状態を確認して、もう一度お試しください。操作結果は成功扱いにしていません。
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            再読み込み
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
