// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDefiSpotToken} from "./interfaces/IDefiSpotToken.sol";

/**
 * @title TokenVesting
 */
contract TokenVesting is Ownable, ReentrancyGuard{
    bytes32 public constant MERKLE_ROOT = 0x8a688de9a32aa43e34941d5ecad5dac4bb799bf8bbc2c5e838734d549f250d3a;
    mapping(address => bool) public whitelistClaimed;

    struct VestingSchedule{
        // beneficiary of tokens after they are released
        address  beneficiary;
        // cliff period in seconds
        uint256  cliff;
        // start time of the vesting period
        uint256  start;
        // duration of the vesting period in seconds
        uint256  duration;
        // duration of a slice period for the vesting in seconds --> constant value
        uint256 slicePeriodSeconds;
        // total amount of tokens to be released at the end of the vesting
        uint256 amountTotal;
        // amount of tokens released
        uint256  released;
        // wheter or not the vesting schedule has been created
        bool initialized;
        // whether or not the vesting is revocable
        bool  revocable; // Should be always be revocable. 
        // whether or not the vesting has been revoked
        bool revoked;
    } 

    // address of the ERC20 token
    IERC20 immutable private _token;

    uint256 private vestingSchedulesTotalAmount;

    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    mapping(address => uint256) private holdersVestingCount;

    bytes32[] private vestingSchedulesIds;

    using SafeERC20 for IERC20;
    
    event Released(uint256 amount);
    event Revoked();

    /**
    * @dev Reverts if no vesting schedule matches the passed identifier.
    */
    modifier onlyIfVestingScheduleExists(bytes32 vestingScheduleId) {
        require(vestingSchedules[vestingScheduleId].initialized, "Schedule should exist!");
        _;
    }

    /**
    * @dev Reverts if the vesting schedule does not exist or has been revoked.
    */
    modifier onlyIfVestingScheduleNotRevoked(bytes32 vestingScheduleId) {
        require(vestingSchedules[vestingScheduleId].initialized, "is not initialized!");
        require(!vestingSchedules[vestingScheduleId].revoked, "vesting schedule revoked!");
        _;
    }

    /**
     * @dev Creates a vesting contract.
     * @param token_ address of the ERC20 token contract
     */
    constructor(address token_) {
        require(token_ != address(0x0), "zero address not allowed!");
        _token = IERC20(token_);
    }

    function whitelistClaim(
            bytes32[] calldata _merkleProof, 
            uint256 _amount, 
            uint256 _cliff, 
            uint256 _duration,
            uint256 _slicePeriodSeconds,
            bool _revocable
        )
        external
        returns (bool status)
    {
        require(!whitelistClaimed[msg.sender], "Address already claimed!");
        whitelistClaimed[msg.sender] = true;

        bytes32 leaf = keccak256(abi.encode(msg.sender,_amount,_cliff,_duration));
        
        require(MerkleProof.verify(_merkleProof, MERKLE_ROOT, leaf), "invalid proof");
        
        require(IDefiSpotToken(address(_token)).mint(_amount), "mint failed!");
        
        status = _createVestingSchedule(
            msg.sender,             // Beneficiary
            getCurrentTime(),       // Vesting schedule start
            _cliff,                 // Cliff period
            _duration,              // Total duration
            _slicePeriodSeconds,    // Slice period in secodns: 1 day
            _revocable,             // Vesting schedule can be revocable
            _amount                 // Total amount to distribute
        );
        require(status, "Scheduled failed!");
    }

    /**
    * @dev Returns the number of vesting schedules associated to a beneficiary.
    * @return the number of vesting schedules
    */
    function getVestingSchedulesCountByBeneficiary(address _beneficiary)
        external
        view
        returns(uint256)
    {
        return holdersVestingCount[_beneficiary];
    }

    /**
    * @dev Returns the vesting schedule id at the given index.
    * @return the vesting id
    */
    function getVestingIdAtIndex(uint256 index)
        external
        view
        returns(bytes32)
    {
        require(index < getVestingSchedulesCount(), "index out of bounds!");
        return vestingSchedulesIds[index];
    }

    /**
    * @notice Returns the vesting schedule information for a given holder and index.
    * @return the vesting schedule structure information
    */
    // We don't need multiple vesting schedules for the same addres!!
    function getVestingScheduleByAddressAndIndex(address holder, uint256 index)
        external
        view
        returns(VestingSchedule memory)
    {
        return getVestingSchedule(computeVestingScheduleIdForAddressAndIndex(holder, index));
    }

    /**
    * @notice Returns the total amount of vesting schedules.
    * @return the total amount of vesting schedules
    */
    function getVestingSchedulesTotalAmount()
        external
        view
        returns(uint256)
    {
        return vestingSchedulesTotalAmount;
    }

    /**
    * @dev Returns the address of the ERC20 token managed by the vesting contract.
    */
    function getToken()
        external
        view
        returns(address)
    {
        return address(_token);
    }

    function createVestingSchedule(
        address _beneficiary,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        bool _revocable,
        uint256 _amount
    )
        external
        onlyOwner()
        returns(bool status)
    {
        status = _createVestingSchedule(
            _beneficiary,             // Beneficiary
            getCurrentTime(),       // Vesting schedule start
            _cliff,                 // Cliff period
            _duration,              // Total duration
            _slicePeriodSeconds,    // Slice period in secodns: 1 day
            _revocable,             // Vesting schedule can be revocable
            _amount                 // Total amount to distribute
        );
        require(status, "Scheduled failed!");
    }

    /**
    * @notice Creates a new vesting schedule for a beneficiary.
    * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
    * @param _start start time of the vesting period
    * @param _cliff duration in seconds of the cliff in which tokens will begin to vest
    * @param _duration duration in seconds of the period in which the tokens will vest
    * @param _slicePeriodSeconds duration of a slice period for the vesting in seconds
    * @param _revocable whether the vesting is revocable or not
    * @param _amount total amount of tokens to be released at the end of the vesting
    */
    function _createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        bool _revocable,
        uint256 _amount
    )
        private
        returns (bool)
    {
        require(
            this.getWithdrawableAmount() >= _amount, "not enough funds!"
        );
        // Validate that duration is greater than cliff
        require(_duration > _cliff, "duration is not valid!");
        require(_duration > 0, "duration must be > 0");
        require(_amount > 0, "amount must be > 0");
        require(_slicePeriodSeconds >= 1, "slicePeriodSeconds must be >= 1");
        bytes32 vestingScheduleId = this.computeNextVestingScheduleIdForHolder(_beneficiary);
        uint256 cliff = _start + _cliff;

        vestingSchedules[vestingScheduleId] = VestingSchedule(
            _beneficiary,
            cliff,
            _start,
            _duration,
            _slicePeriodSeconds,
            _amount,
            0,
            true,
            _revocable,
            false
        );
        
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount + _amount;
        vestingSchedulesIds.push(vestingScheduleId);
        uint256 currentVestingCount = holdersVestingCount[_beneficiary];
        holdersVestingCount[_beneficiary] = currentVestingCount + 1;

        return true;
    }

    /**
    * @notice Revokes the vesting schedule for given identifier.
    * @param vestingScheduleId the vesting schedule identifier
    */
    function revoke(bytes32 vestingScheduleId)
        external
        onlyOwner
        onlyIfVestingScheduleNotRevoked(vestingScheduleId)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(vestingSchedule.revocable, "vesting is not revocable!"); // Do we need this?
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        if(vestedAmount > 0){
            require(release(vestingScheduleId, vestedAmount), "release failed!");
        }
        uint256 unreleased = vestingSchedule.amountTotal - vestingSchedule.released;
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount - unreleased;
        vestingSchedule.revoked = true;
    }

    /**
    * @notice Withdraw the specified amount if possible.
    * @param amount the amount to withdraw
    */
    function withdraw(uint256 amount)
        external
        nonReentrant
        onlyOwner
    {
        require(this.getWithdrawableAmount() >= amount, "not enough withdrawable funds!");
        _token.safeTransfer(owner(), amount);
    }

    /**
    * @notice Release vested amount of tokens.
    * @param vestingScheduleId the vesting schedule identifier
    * @param amount the amount to release
    */
    function release(
        bytes32 vestingScheduleId,
        uint256 amount // We shouldn't allow to release partially amounts.
    )
        public
        nonReentrant
        onlyIfVestingScheduleNotRevoked(vestingScheduleId)
        returns (bool)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        bool isBeneficiary = msg.sender == vestingSchedule.beneficiary;
        bool isOwner = msg.sender == owner();
        require(
            isBeneficiary || isOwner,
            "only beneficiary and owner!"
        );
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        require(vestedAmount >= amount, "cannot release tokens!");
        vestingSchedule.released = vestingSchedule.released + amount;
        address beneficiaryPayable =  vestingSchedule.beneficiary;
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount - amount;
        // Release everything. 
        _token.safeTransfer(beneficiaryPayable, amount);

        return true;
    }

    /**
    * @dev Returns the number of vesting schedules managed by this contract.
    * @return the number of vesting schedules
    */
    function getVestingSchedulesCount()
        public
        view
        returns(uint256){
        return vestingSchedulesIds.length;
    }

    /**
    * @notice Computes the vested amount of tokens for the given vesting schedule identifier.
    * @return the vested amount
    */
    function computeReleasableAmount(bytes32 vestingScheduleId)
        external
        onlyIfVestingScheduleNotRevoked(vestingScheduleId)
        view
        returns(uint256){
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        return _computeReleasableAmount(vestingSchedule);
    }

    /**
    * @notice Returns the vesting schedule information for a given identifier.
    * @return the vesting schedule structure information
    */
    function getVestingSchedule(bytes32 vestingScheduleId)
        public
        view
        returns(VestingSchedule memory){
        return vestingSchedules[vestingScheduleId];
    }

    /**
    * @dev Returns the amount of tokens that can be withdrawn by the owner.
    * @return the amount of tokens
    */
    function getWithdrawableAmount()
        external
        view
        returns(uint256){
        return _token.balanceOf(address(this)) - vestingSchedulesTotalAmount;
    }

    /**
    * @dev Computes the next vesting schedule identifier for a given holder address.
    */
    function computeNextVestingScheduleIdForHolder(address holder)
        external
        view
        returns(bytes32){
        return computeVestingScheduleIdForAddressAndIndex(holder, holdersVestingCount[holder]);
    }

    /**
    * @dev Returns the last vesting schedule for a given holder address.
    */
    function getLastVestingScheduleForHolder(address holder)
        external
        view
        returns(VestingSchedule memory){
        return vestingSchedules[computeVestingScheduleIdForAddressAndIndex(holder, holdersVestingCount[holder] - 1)];
    }

    /**
    * @dev Computes the vesting schedule identifier for an address and an index.
    */
    function computeVestingScheduleIdForAddressAndIndex(address holder, uint256 index)
        public
        pure
        returns(bytes32){
        return keccak256(abi.encodePacked(holder,index));
    }

    /**
    * @dev Computes the releasable amount of tokens for a vesting schedule.
    * @return the amount of releasable tokens
    */
    function _computeReleasableAmount(VestingSchedule memory vestingSchedule)
    internal
    view
    returns(uint256){
        uint256 currentTime = getCurrentTime();

        if ((currentTime < vestingSchedule.cliff) || vestingSchedule.revoked) {
            return 0;
        } else if (currentTime >= vestingSchedule.start + vestingSchedule.duration) {
            return vestingSchedule.amountTotal - vestingSchedule.released;
        } else {
            uint256 timeFromStart = currentTime - vestingSchedule.start;
            uint256 secondsPerSlice = vestingSchedule.slicePeriodSeconds;
            uint256 vestedSlicePeriods = timeFromStart / secondsPerSlice;
            uint256 vestedSeconds = vestedSlicePeriods * secondsPerSlice;
            uint256 vestedAmount = (vestingSchedule.amountTotal * vestedSeconds) / vestingSchedule.duration;
            vestedAmount = vestedAmount - vestingSchedule.released;
            return vestedAmount;
        }
    }

    function getCurrentTime()
        internal
        virtual
        view
        returns(uint256){
        return block.timestamp;
    }

}