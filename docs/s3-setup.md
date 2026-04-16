# S3 Bucket Setup

## 1. Create the bucket

```bash
aws s3api create-bucket \
  --bucket your-screen-recorder-bucket \
  --region us-east-1
```

## 2. Block all public access (required)

In the AWS console: **S3 → your bucket → Permissions → Block public access** → enable all four options.

Or via CLI:
```bash
aws s3api put-public-access-block \
  --bucket your-screen-recorder-bucket \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## 3. Apply the CORS policy

The browser uploads directly to S3 using a presigned PUT URL, so CORS is required for PUT only.

Edit `docs/s3-cors.json` — replace the production origin — then:

```bash
aws s3api put-bucket-cors \
  --bucket your-screen-recorder-bucket \
  --cors-configuration file://docs/s3-cors.json
```

## 4. Apply the bucket policy (optional hardening)

Edit `docs/s3-bucket-policy.json` — replace `YOUR-BUCKET-NAME` and `YOUR-ACCOUNT-ID` — then:

```bash
aws s3api put-bucket-policy \
  --bucket your-screen-recorder-bucket \
  --policy file://docs/s3-bucket-policy.json
```

## 5. IAM user for the app

Create an IAM user with programmatic access only. Attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-screen-recorder-bucket/*"
    }
  ]
}
```

Copy the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into your `.env`.

## How uploads work (no public access needed)

1. Browser calls `trpc.upload.presign` → server generates a presigned `PUT` URL (1 hour TTL)
2. Browser uploads the file blob directly to that URL via XHR
3. Server calls `trpc.upload.ingestToMux` → server generates a presigned `GET` URL (15 min TTL) and gives it to Mux
4. Mux fetches the file, transcodes it, and serves HLS — S3 is never accessed publicly
