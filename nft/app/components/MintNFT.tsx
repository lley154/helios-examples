import { useState } from 'react'

const mintNFT = ({ onMintNFT } : any) => {

    const [address, setAddress] = useState('')
    const [name, setName] = useState('')

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onMintNFT([address, name])
    }
    

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Destination Wallet Address</b> 
                <br></br>
                <input name='address' type='text' id='address' placeholder='Enter Destination Wallet Address' 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                <b>NFT Token Name</b> 
                <br></br>
                <input name='name' type='text' id='name' placeholder='Enter NFT Token Name' 
                value={name}
                onChange={(e) => setName(e.target.value)}
                />
            </div>
            <br></br>                   
            <input type='submit' value='Transfer Ada'/>
        </form>
    )
}

export default mintNFT